import { describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import { repairZipDataDescriptors } from "../zip-repair";
import { buildExportWorkbook } from "../exporter";
import { ProcessedRow } from "../types";

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const DATA_DESCRIPTOR_SIGNATURE = 0x08074b50;
const DATA_DESCRIPTOR_FLAG = 0x0008;

interface CdEntry {
  name: string;
  flags: number;
  crc32: number;
  csz: number;
  usz: number;
  lho: number;
  cdEntryStart: number;
}

function readZipDirectory(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  let eocdOffset = -1;
  for (let i = buffer.byteLength - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === EOCD_SIGNATURE) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) throw new Error("EOCD not found in test fixture");

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);

  const entries: CdEntry[] = [];
  let pos = cdOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (view.getUint32(pos, true) !== CENTRAL_DIRECTORY_SIGNATURE) throw new Error("bad CD signature in fixture");
    const cdEntryStart = pos;
    const flags = view.getUint16(pos + 8, true);
    const crc32 = view.getUint32(pos + 16, true);
    const csz = view.getUint32(pos + 20, true);
    const usz = view.getUint32(pos + 24, true);
    const nameLength = view.getUint16(pos + 28, true);
    const extraLength = view.getUint16(pos + 30, true);
    const commentLength = view.getUint16(pos + 32, true);
    const lho = view.getUint32(pos + 42, true);
    const name = new TextDecoder().decode(new Uint8Array(buffer, pos + 46, nameLength));
    entries.push({ name, flags, crc32, csz, usz, lho, cdEntryStart });
    pos += 46 + nameLength + extraLength + commentLength;
  }

  return { eocdOffset, cdOffset, totalEntries, entries };
}

/** Rewrites one entry of an otherwise well-formed ZIP (as produced by our own exporter)
 * into the exact malformed shape Clockify's exporter emits: streaming mode (data
 * descriptor, general-purpose flag bit 3) with a correct CRC32 and compressed size but a
 * zeroed-out uncompressed-size field. Every other entry is left byte-for-byte untouched
 * (only relocated, since inserting the trailing descriptor shifts later offsets). This
 * reproduces the real-world bug using only synthetic, non-sensitive fixture content. */
function corruptOneEntryLikeClockifyExport(buffer: ArrayBuffer, targetName: string): ArrayBuffer {
  const { entries } = readZipDirectory(buffer);
  const target = entries.find((e) => e.name === targetName);
  if (!target) throw new Error(`fixture entry "${targetName}" not found`);

  const view = new DataView(buffer);
  const nameLength = view.getUint16(target.lho + 26, true);
  const extraLength = view.getUint16(target.lho + 28, true);
  const localHeaderLength = 30 + nameLength + extraLength;
  const dataStart = target.lho + localHeaderLength;

  const before = new Uint8Array(buffer, 0, target.lho);
  const headerBytes = new Uint8Array(buffer.slice(target.lho, dataStart));
  const compressedData = new Uint8Array(buffer, dataStart, target.csz);
  const after = new Uint8Array(buffer, dataStart + target.csz);

  // Flip the local header's flag bit 3 and zero its (now-placeholder) size/crc fields.
  const newHeader = new Uint8Array(headerBytes);
  const headerView = new DataView(newHeader.buffer);
  headerView.setUint16(6, headerView.getUint16(6, true) | DATA_DESCRIPTOR_FLAG, true);
  headerView.setUint32(14, 0, true); // crc32 placeholder
  headerView.setUint32(18, 0, true); // compressed size placeholder
  headerView.setUint32(22, 0, true); // uncompressed size placeholder

  // Trailing data descriptor: correct signature, correct CRC32 + compressed size, but a
  // zeroed uncompressed size — exactly what Clockify's exporter writes.
  const descriptor = new Uint8Array(16);
  const descriptorView = new DataView(descriptor.buffer);
  descriptorView.setUint32(0, DATA_DESCRIPTOR_SIGNATURE, true);
  descriptorView.setUint32(4, target.crc32, true);
  descriptorView.setUint32(8, target.csz, true);
  descriptorView.setUint32(12, 0, true); // <- the bug

  const insertedBytes = descriptor.length;

  const rebuiltEntryRegion = new Uint8Array(newHeader.length + compressedData.length + descriptor.length);
  rebuiltEntryRegion.set(newHeader, 0);
  rebuiltEntryRegion.set(compressedData, newHeader.length);
  rebuiltEntryRegion.set(descriptor, newHeader.length + compressedData.length);

  const rebuilt = new Uint8Array(before.length + rebuiltEntryRegion.length + after.length);
  rebuilt.set(before, 0);
  rebuilt.set(rebuiltEntryRegion, before.length);
  rebuilt.set(after, before.length + rebuiltEntryRegion.length);

  const rebuiltView = new DataView(rebuilt.buffer);

  // The whole central directory sits after all entry data, so it always shifts by the
  // inserted amount; rewrite every CD record's header-offset (and the target's flags) in
  // the rebuilt buffer at the (also shifted) CD position.
  const { cdOffset: originalCdOffset, entries: originalEntries } = readZipDirectory(buffer);
  const newCdOffset = originalCdOffset + insertedBytes;
  let cdPos = newCdOffset;
  for (const entry of originalEntries) {
    const newLho = entry.lho > target.lho ? entry.lho + insertedBytes : entry.lho;
    rebuiltView.setUint32(cdPos + 42, newLho, true);
    if (entry.name === targetName) {
      rebuiltView.setUint16(cdPos + 8, rebuiltView.getUint16(cdPos + 8, true) | DATA_DESCRIPTOR_FLAG, true);
    }
    const nameLen = rebuiltView.getUint16(cdPos + 28, true);
    const extraLen = rebuiltView.getUint16(cdPos + 30, true);
    const commentLen = rebuiltView.getUint16(cdPos + 32, true);
    cdPos += 46 + nameLen + extraLen + commentLen;
  }

  // Fix up the EOCD's central-directory offset.
  const { eocdOffset } = readZipDirectory(buffer);
  rebuiltView.setUint32(eocdOffset + insertedBytes + 16, newCdOffset, true);

  return rebuilt.buffer;
}

function buildSyntheticFixtureBuffer(): ArrayBuffer {
  const rows: ProcessedRow[] = [
    {
      id: "1",
      project: "Organic Apply",
      client: "LendingPoint",
      description: "[OA-1]: synthetic fixture row",
      task: "OA-1",
      user: "Test User",
      duration: 1,
      projectConfidence: "automatic",
      taskConfidence: "derived",
      groupKey: "task:OA-1",
      isAlexRow: false,
    },
  ];
  const workbook = buildExportWorkbook(rows);
  // Clockify's exporter writes DEFLATE-compressed entries (method 8), which is exactly
  // why its bug is recoverable at all: a raw DEFLATE stream is self-terminating, so
  // decompression works even when the declared uncompressed size is wrong. SheetJS's own
  // default writer uses STORED (uncompressed) entries, which have no such property, so
  // `compression: true` is needed here to reproduce the real-world entry type.
  const out = XLSX.write(workbook, { type: "array", bookType: "xlsx", compression: true }) as ArrayBuffer;
  return out;
}

describe("repairZipDataDescriptors", () => {
  it("fixes a zeroed uncompressed-size descriptor field without touching anything else", () => {
    const clean = buildSyntheticFixtureBuffer();
    const corrupted = corruptOneEntryLikeClockifyExport(clean, "[Content_Types].xml");

    const { entries: corruptedEntries } = readZipDirectory(corrupted);
    const contentTypesBefore = corruptedEntries.find((e) => e.name === "[Content_Types].xml")!;
    expect(contentTypesBefore.flags & DATA_DESCRIPTOR_FLAG).toBeTruthy();

    const repaired = repairZipDataDescriptors(corrupted);

    // Reading the repaired ZIP back with the exact same logic used above confirms the
    // central directory (still correct) and the entry now agree: parse it end-to-end.
    const workbook = XLSX.read(repaired, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    expect(json[0]).toMatchObject({ Project: "Organic Apply", Task: "OA-1", User: "Test User" });
  });

  it("silences the SheetJS diagnostic that the corrupted fixture triggers", () => {
    const clean = buildSyntheticFixtureBuffer();
    const corrupted = corruptOneEntryLikeClockifyExport(clean, "[Content_Types].xml");

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    XLSX.read(corrupted, { type: "array" });
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Bad uncompressed size"));
    errorSpy.mockRestore();

    const repaired = repairZipDataDescriptors(corrupted);
    const errorSpy2 = vi.spyOn(console, "error").mockImplementation(() => {});
    XLSX.read(repaired, { type: "array" });
    expect(errorSpy2).not.toHaveBeenCalled();
    errorSpy2.mockRestore();
  });

  it("leaves an already well-formed ZIP completely untouched", () => {
    const clean = buildSyntheticFixtureBuffer();
    const result = repairZipDataDescriptors(clean);
    expect(result).toBe(clean);
  });

  it("safely no-ops on a buffer that isn't a ZIP at all", () => {
    const notAZip = new TextEncoder().encode("hello world, not a zip file").buffer;
    const result = repairZipDataDescriptors(notAZip);
    expect(result).toBe(notAZip);
  });
});
