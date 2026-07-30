/**
 * Contour a scalar grid where value <= threshold into GeoJSON polygons.
 * Uses raster boundary tracing (cell edges) for reliable closed rings.
 *
 * Grid values are row-major, `values[row * cols + col]`, row 0 = south (min lat).
 */

export type GridScalar = {
  values: Float64Array;
  cols: number;
  rows: number;
  west: number;
  south: number;
  cellWidth: number;
  cellHeight: number;
};

type Vert = string; // `${r},${c}` grid corner

/** Contour cells where value <= threshold (reachable within threshold minutes). */
export function contourPolygon(
  grid: GridScalar,
  threshold: number,
): GeoJSON.Polygon | GeoJSON.MultiPolygon | null {
  const { values, cols, rows, west, south, cellWidth, cellHeight } = grid;

  const inside = (r: number, c: number): boolean => {
    if (r < 0 || c < 0 || r >= rows || c >= cols) return false;
    return values[r * cols + c]! <= threshold;
  };

  // Outgoing directed edges per vertex (CW around inside). Multiple outs are
  // allowed where components touch at a corner — a single Map overwrite would
  // drop edges and yield no closed rings on real isochrone shapes.
  const outs = new Map<Vert, Vert[]>();
  const addEdge = (a: Vert, b: Vert) => {
    const list = outs.get(a);
    if (list) {
      if (!list.includes(b)) list.push(b);
    } else {
      outs.set(a, [b]);
    }
  };

  const vKey = (r: number, c: number): Vert => `${r},${c}`;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!inside(r, c)) continue;
      if (!inside(r - 1, c)) addEdge(vKey(r, c), vKey(r, c + 1));
      if (!inside(r, c + 1)) addEdge(vKey(r, c + 1), vKey(r + 1, c + 1));
      if (!inside(r + 1, c)) addEdge(vKey(r + 1, c + 1), vKey(r + 1, c));
      if (!inside(r, c - 1)) addEdge(vKey(r + 1, c), vKey(r, c));
    }
  }

  if (outs.size === 0) return null;

  const toLngLat = (key: Vert): [number, number] => {
    const [rs, cs] = key.split(",");
    return [west + Number(cs) * cellWidth, south + Number(rs) * cellHeight];
  };

  const usedEdges = new Set<string>();
  const edgeKey = (a: Vert, b: Vert) => `${a}>${b}`;

  const takeNext = (from: Vert): Vert | null => {
    for (const to of outs.get(from) ?? []) {
      const ek = edgeKey(from, to);
      if (!usedEdges.has(ek)) {
        usedEdges.add(ek);
        return to;
      }
    }
    return null;
  };

  let edgeCount = 0;
  for (const list of outs.values()) edgeCount += list.length;

  const rings: number[][][] = [];

  for (const start of outs.keys()) {
    if (!(outs.get(start) ?? []).some((to) => !usedEdges.has(edgeKey(start, to)))) {
      continue;
    }

    const ring: [number, number][] = [];
    let cur = start;
    for (let guard = 0; guard < edgeCount + 2; guard++) {
      const n = takeNext(cur);
      if (n == null) break;
      ring.push(toLngLat(cur));
      if (n === start) {
        ring.push(toLngLat(start));
        if (ring.length >= 4) rings.push(ring);
        break;
      }
      cur = n;
    }
  }

  if (rings.length === 0) return null;
  return smoothGeometry(nestRings(rings), 2);
}

/** Chaikin corner-cutting — softens raster stairsteps without a huge grid. */
function chaikinRing(ring: number[][], iterations: number): number[][] {
  let current = ring;
  for (let iter = 0; iter < iterations; iter++) {
    // Drop closing duplicate for processing
    const open =
      current.length > 1 &&
      current[0]![0] === current[current.length - 1]![0] &&
      current[0]![1] === current[current.length - 1]![1]
        ? current.slice(0, -1)
        : current.slice();
    if (open.length < 3) return ring;
    const next: number[][] = [];
    for (let i = 0; i < open.length; i++) {
      const p0 = open[i]!;
      const p1 = open[(i + 1) % open.length]!;
      next.push([
        0.75 * p0[0]! + 0.25 * p1[0]!,
        0.75 * p0[1]! + 0.25 * p1[1]!,
      ]);
      next.push([
        0.25 * p0[0]! + 0.75 * p1[0]!,
        0.25 * p0[1]! + 0.75 * p1[1]!,
      ]);
    }
    next.push(next[0]!);
    current = next;
  }
  return current;
}

function smoothGeometry(
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon,
  iterations: number,
): GeoJSON.Polygon | GeoJSON.MultiPolygon {
  if (geometry.type === "Polygon") {
    return {
      type: "Polygon",
      coordinates: geometry.coordinates.map((ring) =>
        chaikinRing(ring, iterations),
      ),
    };
  }
  return {
    type: "MultiPolygon",
    coordinates: geometry.coordinates.map((poly) =>
      poly.map((ring) => chaikinRing(ring, iterations)),
    ),
  };
}

function ringArea(ring: number[][]): number {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    sum += xj * yi - xi * yj;
  }
  return Math.abs(sum) / 2;
}

function pointInRing(point: [number, number], ring: number[][]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0]!;
    const yi = ring[i]![1]!;
    const xj = ring[j]![0]!;
    const yj = ring[j]![1]!;
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function nestRings(
  rings: number[][][],
): GeoJSON.Polygon | GeoJSON.MultiPolygon {
  if (rings.length === 1) {
    return { type: "Polygon", coordinates: [rings[0]!] };
  }

  const indexed = rings.map((ring, i) => ({
    ring,
    i,
    area: ringArea(ring),
  }));
  indexed.sort((a, b) => b.area - a.area);

  const parentOf = new Map<number, number | null>();
  for (const item of indexed) parentOf.set(item.i, null);

  for (let a = 0; a < indexed.length; a++) {
    const inner = indexed[a]!;
    const probe = inner.ring[0] as [number, number];
    let parent: number | null = null;
    let parentArea = Infinity;
    for (let b = 0; b < a; b++) {
      const outer = indexed[b]!;
      if (outer.area <= inner.area) continue;
      if (pointInRing(probe, outer.ring) && outer.area < parentArea) {
        parent = outer.i;
        parentArea = outer.area;
      }
    }
    parentOf.set(inner.i, parent);
  }

  const depth = new Map<number, number>();
  const depthOf = (i: number): number => {
    if (depth.has(i)) return depth.get(i)!;
    const p = parentOf.get(i);
    const d = p == null ? 0 : depthOf(p) + 1;
    depth.set(i, d);
    return d;
  };

  const exteriors = indexed.filter((item) => depthOf(item.i) % 2 === 0);
  if (exteriors.length === 0) {
    return {
      type: "MultiPolygon",
      coordinates: rings.map((r) => [r]),
    };
  }

  const polygons: number[][][][] = exteriors.map((ext) => {
    const holes = indexed
      .filter(
        (item) =>
          parentOf.get(item.i) === ext.i &&
          depthOf(item.i) === depthOf(ext.i) + 1,
      )
      .map((h) => h.ring);
    return [ext.ring, ...holes];
  });

  if (polygons.length === 1) {
    return { type: "Polygon", coordinates: polygons[0]! };
  }
  return { type: "MultiPolygon", coordinates: polygons };
}
