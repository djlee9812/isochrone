/** Mean of non-null ETA rows across days (one row per depart_at). */
export function meanEtas(
  rows: Array<(number | null)[]>,
): (number | null)[] {
  if (rows.length === 0) return [];
  const n = Math.max(0, ...rows.map((r) => r.length));
  const out: (number | null)[] = [];
  for (let i = 0; i < n; i++) {
    let sum = 0;
    let count = 0;
    for (const row of rows) {
      const v = row[i];
      if (v != null) {
        sum += v;
        count += 1;
      }
    }
    out.push(count > 0 ? Math.round(sum / count) : null);
  }
  return out;
}
