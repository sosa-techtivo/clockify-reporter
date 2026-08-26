/**
 * Some Clockify "Detailed Report" exports produce a ZIP (.xlsx) container where every
 * entry is written in streaming mode (general-purpose flag bit 3 set, so the local file
 * header's sizes are placeholders and the real sizes/CRC live in a trailing "data
 * descriptor"). Clockify's exporter writes that data descriptor's compressed-size and
 * CRC32 correctly, but always writes 0 for the *uncompressed* size field, even though the
 * uncompressed size is recorded correctly in the ZIP's central directory.
 *
 * SheetJS decompresses the entry correctly regardless (raw DEFLATE streams are
 * self-terminating), but it also cross-checks the data descriptor against the central
 * directory as an integrity signal and — quite reasonably — logs a "Bad uncompressed
 * size" console.error for every single entry when that check fails. The extracted data
 * is not affected, but the diagnostic is real and would fire on every Clockify export.
 *
 * Rather than silencing that diagnostic, this repairs the actual malformed bytes before
 * SheetJS ever sees them: it reads the authoritative sizes from the central directory and
 * patches only the 4-byte "uncompressed size" field of each data descriptor that disagrees
 * with it. Every step is guarded — if the ZIP doesn't match the exact shape this function
 * understands (unexpected signatures, ZIP64, a descriptor whose CRC/compressed-size don't
 * match the central directory), it leaves the bytes untouched and lets SheetJS report
 * whatever it finds, exactly as before.
 */

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const DATA_DESCRIPTOR_SIGNATURE = 0x08074b50;
const DATA_DESCRIPTOR_FLAG = 0x0008;
const ZIP64_MARKER = 0xffffffff;
const MAX_EOCD_COMMENT_LENGTH = 65535;

interface CentralDirectoryEntry {
  flags: number;
  crc32: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

function findEndOfCentralDirectory(view: DataView): number | null {
  const searchStart = Math.max(0, view.byteLength - 22 - MAX_EOCD_COMMENT_LENGTH);
  for (let i = view.byteLength - 22; i >= searchStart; i--) {
    if (view.getUint32(i, true) === EOCD_SIGNATURE) return i;
  }
  return null;
}

function readCentralDirectoryEntries(view: DataView, cdOffset: number, totalEntries: number): CentralDirectoryEntry[] | null {
  const entries: CentralDirectoryEntry[] = [];
  let pos = cdOffset;

  for (let i = 0; i < totalEntries; i++) {
    if (pos + 46 > view.byteLength || view.getUint32(pos, true) !== CENTRAL_DIRECTORY_SIGNATURE) {
      return null;
    }
    const flags = view.getUint16(pos + 8, true);
    const crc32 = view.getUint32(pos + 16, true);
    const compressedSize = view.getUint32(pos + 20, true);
    const uncompressedSize = view.getUint32(pos + 24, true);
    const nameLength = view.getUint16(pos + 28, true);
    const extraLength = view.getUint16(pos + 30, true);
    const commentLength = view.getUint16(pos + 32, true);
    const localHeaderOffset = view.getUint32(pos + 42, true);

    if (compressedSize === ZIP64_MARKER || uncompressedSize === ZIP64_MARKER || localHeaderOffset === ZIP64_MARKER) {
      return null; // ZIP64 sizes live in an extra field this function doesn't parse — bail out safely.
    }

    entries.push({ flags, crc32, compressedSize, uncompressedSize, localHeaderOffset });
    pos += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

/** Patches a single entry's data descriptor in place (on `bytes`) if — and only if — every
 * expected field lines up with the central directory, except uncompressed size. */
function repairEntryDescriptor(view: DataView, entry: CentralDirectoryEntry): boolean {
  if ((entry.flags & DATA_DESCRIPTOR_FLAG) === 0) return false;

  const lho = entry.localHeaderOffset;
  if (lho + 30 > view.byteLength || view.getUint32(lho, true) !== LOCAL_FILE_HEADER_SIGNATURE) return false;

  const nameLength = view.getUint16(lho + 26, true);
  const extraLength = view.getUint16(lho + 28, true);
  const dataStart = lho + 30 + nameLength + extraLength;
  const descriptorStart = dataStart + entry.compressedSize;

  if (descriptorStart + 12 > view.byteLength) return false;

  const hasOptionalSignature = view.getUint32(descriptorStart, true) === DATA_DESCRIPTOR_SIGNATURE;
  const fieldsStart = hasOptionalSignature ? descriptorStart + 4 : descriptorStart;
  if (fieldsStart + 12 > view.byteLength) return false;

  const descriptorCrc32 = view.getUint32(fieldsStart, true);
  const descriptorCompressedSize = view.getUint32(fieldsStart + 4, true);
  const descriptorUncompressedSize = view.getUint32(fieldsStart + 8, true);

  // Only touch the uncompressed-size field, and only when everything else we can verify
  // (CRC32, compressed size) confirms we've located the right descriptor.
  if (descriptorCrc32 !== entry.crc32) return false;
  if (descriptorCompressedSize !== entry.compressedSize) return false;
  if (descriptorUncompressedSize === entry.uncompressedSize) return false;

  view.setUint32(fieldsStart + 8, entry.uncompressedSize, true);
  return true;
}

/** Returns a copy of `buffer` with any malformed ZIP data-descriptor "uncompressed size"
 * fields corrected against the central directory. Returns the original buffer, untouched,
 * if the ZIP doesn't match the exact shape this function knows how to repair. */
export function repairZipDataDescriptors(buffer: ArrayBuffer): ArrayBuffer {
  if (buffer.byteLength < 22) return buffer;

  const original = new Uint8Array(buffer);
  const originalView = new DataView(buffer);

  const eocdOffset = findEndOfCentralDirectory(originalView);
  if (eocdOffset === null) return buffer;

  const totalEntries = originalView.getUint16(eocdOffset + 10, true);
  const cdOffset = originalView.getUint32(eocdOffset + 16, true);
  if (cdOffset === ZIP64_MARKER) return buffer; // ZIP64 central directory — not handled here.

  const entries = readCentralDirectoryEntries(originalView, cdOffset, totalEntries);
  if (!entries) return buffer;

  const repaired = new Uint8Array(original); // work on a copy; never mutate the caller's buffer
  const repairedView = new DataView(repaired.buffer);
  let repairedAny = false;

  for (const entry of entries) {
    if (repairEntryDescriptor(repairedView, entry)) repairedAny = true;
  }

  return repairedAny ? repaired.buffer : buffer;
}
