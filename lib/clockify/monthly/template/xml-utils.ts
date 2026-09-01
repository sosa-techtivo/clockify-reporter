/** Escapes text for use inside XML element content or a double-quoted attribute value. */
export function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** OOXML/XML trims insignificant leading/trailing whitespace inside <t> unless told not
 * to — a Description with a trailing space (real Clockify data has these) would silently
 * lose it on the round trip without this. */
export function needsSpacePreserve(value: string): boolean {
  return value !== value.trim();
}
