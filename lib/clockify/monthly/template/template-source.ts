/** Served from public/monthly-template/ — a byte-identical copy of
 * reference/Clockify_Julio_2026.xlsx, placed under public/ so the browser can fetch it
 * client-side (this app has no backend). Keep the two in sync if the reference template
 * is ever replaced. */
const TEMPLATE_URL = "/monthly-template/Clockify_Julio_2026.xlsx";

export async function fetchMonthlyTemplateBytes(): Promise<Uint8Array> {
  const response = await fetch(TEMPLATE_URL);
  if (!response.ok) {
    throw new Error(`Could not load the Monthly Report template (HTTP ${response.status}).`);
  }
  return new Uint8Array(await response.arrayBuffer());
}
