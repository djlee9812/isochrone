/**
 * Ray-casting point-in-polygon for GeoJSON Polygon / MultiPolygon.
 * Coordinates are [lng, lat].
 */
export function pointInPolygon(
  point: [number, number],
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon,
): boolean {
  if (geometry.type === "Polygon") {
    return polygonContains(point, geometry.coordinates);
  }
  return geometry.coordinates.some((poly) => polygonContains(point, poly));
}

function polygonContains(
  point: [number, number],
  rings: number[][][],
): boolean {
  if (rings.length === 0) return false;
  // Exterior ring must contain; holes must not
  if (!ringContains(point, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) {
    if (ringContains(point, rings[i])) return false;
  }
  return true;
}

function ringContains(point: [number, number], ring: number[][]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** True if point is inside any polygon feature with contour <= maxMinutes */
export function pointInsideContour(
  point: [number, number],
  collection: GeoJSON.FeatureCollection | null,
  maxMinutes: number,
): boolean {
  if (!collection) return false;
  for (const feature of collection.features) {
    const contour = feature.properties?.contour;
    if (typeof contour !== "number" || contour > maxMinutes) continue;
    const g = feature.geometry;
    if (!g || (g.type !== "Polygon" && g.type !== "MultiPolygon")) continue;
    if (pointInPolygon(point, g)) return true;
  }
  return false;
}
