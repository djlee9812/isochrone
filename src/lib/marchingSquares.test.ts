import { describe, expect, it } from "vitest";
import { contourPolygon } from "./marchingSquares";
import { pointInPolygon } from "./pointInPolygon";

describe("contourPolygon", () => {
  it("contours a solid block", () => {
    const cols = 12;
    const rows = 12;
    const values = new Float64Array(cols * rows);
    values.fill(Number.POSITIVE_INFINITY);
    for (let r = 3; r < 9; r++) {
      for (let c = 3; c < 9; c++) values[r * cols + c] = 30;
    }
    const g = contourPolygon(
      { values, cols, rows, west: 0, south: 0, cellWidth: 1, cellHeight: 1 },
      30,
    );
    expect(g).not.toBeNull();
    expect(pointInPolygon([6, 6], g!)).toBe(true);
    expect(pointInPolygon([0.5, 0.5], g!)).toBe(false);
  });

  it("contours a C-shaped region", () => {
    const cols = 16;
    const rows = 16;
    const values = new Float64Array(cols * rows);
    values.fill(Number.POSITIVE_INFINITY);
    for (let r = 3; r < 13; r++) {
      for (let c = 3; c < 13; c++) {
        // C shape: open on the right
        if (c > 8 && r > 6 && r < 10) continue;
        values[r * cols + c] = 30;
      }
    }
    const g = contourPolygon(
      { values, cols, rows, west: 0, south: 0, cellWidth: 1, cellHeight: 1 },
      30,
    );
    expect(g).not.toBeNull();
    expect(pointInPolygon([5, 8], g!)).toBe(true);
    expect(pointInPolygon([10, 8], g!)).toBe(false);
  });
});
