export function siteAssetUrl(sitePath: string, assetPath: string): string {
  const site = encodeURIComponent(sitePath);
  const file = encodeURIComponent(assetPath);
  return `nefsite://assets/?site=${site}&file=${file}`;
}
