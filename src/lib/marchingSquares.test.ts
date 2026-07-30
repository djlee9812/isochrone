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

  it("contours a C-shaped region with a wide mouth", () => {
    const cols = 20;
    const rows = 20;
    const values = new Float64Array(cols * rows);
    values.fill(Number.POSITIVE_INFINITY);
    for (let r = 3; r < 17; r++) {
      for (let c = 3; c < 17; c++) {
        if (c > 8 && r > 6 && r < 13) continue;
        values[r * cols + c] = 30;
      }
    }
    const g = contourPolygon(
      { values, cols, rows, west: 0, south: 0, cellWidth: 1, cellHeight: 1 },
      30,
    );
    expect(g).not.toBeNull();
    expect(pointInPolygon([5, 10], g!)).toBe(true);
    expect(pointInPolygon([12, 10], g!)).toBe(false);
  });

  it("keeps a thin continuous arm", () => {
    const cols = 40;
    const rows = 20;
    const values = new Float64Array(cols * rows);
    values.fill(Number.POSITIVE_INFINITY);
    for (let r = 6; r < 14; r++) {
      for (let c = 2; c < 10; c++) values[r * cols + c] = 30;
    }
    for (let c = 10; c < 36; c++) values[10 * cols + c] = 30;
    const g = contourPolygon(
      { values, cols, rows, west: 0, south: 0, cellWidth: 1, cellHeight: 1 },
      30,
    );
    expect(g).not.toBeNull();
    expect(pointInPolygon([30.5, 10.5], g!)).toBe(true);
  });

  /**
   * Typical grids are stepwise bands (15/30/60), not a smooth field.
   * Contouring at 30 must work when the outside is the next band (60),
   * not only when it is Infinity — value-lerp MS collapses there.
   */
  it("contours 30-band against neighboring 60-band", () => {
    const cols = 20;
    const rows = 20;
    const values = new Float64Array(cols * rows);
    values.fill(Number.POSITIVE_INFINITY);
    for (let r = 2; r < 18; r++) {
      for (let c = 2; c < 18; c++) values[r * cols + c] = 60;
    }
    for (let r = 6; r < 14; r++) {
      for (let c = 6; c < 14; c++) values[r * cols + c] = 30;
    }
    const g = contourPolygon(
      { values, cols, rows, west: 0, south: 0, cellWidth: 1, cellHeight: 1 },
      30,
    );
    expect(g).not.toBeNull();
    expect(pointInPolygon([10, 10], g!)).toBe(true);
    expect(pointInPolygon([4, 4], g!)).toBe(false);
  });
});
