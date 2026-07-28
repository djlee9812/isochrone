/** Primary autocomplete line: house number + street when Mapbox provides both. */
export function formatGeocodeLabel(
  address: string | undefined,
  text: string,
): string {
  return address ? `${address} ${text}` : text;
}

/** Secondary line: city/region without repeating the bold primary. */
export function suggestContext(label: string, placeName: string): string {
  const prefix = `${label}, `;
  if (placeName.startsWith(prefix)) return placeName.slice(prefix.length);
  return placeName;
}
