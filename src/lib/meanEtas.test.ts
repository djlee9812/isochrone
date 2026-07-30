import { describe, expect, it } from "vitest";
import { meanEtas } from "./meanEtas";

describe("meanEtas", () => {
  it("averages non-null values across days", () => {
    expect(
      meanEtas([
        [10, 20, null],
        [14, null, 30],
      ]),
    ).toEqual([12, 20, 30]);
  });

  it("returns null when every day is null for a destination", () => {
    expect(meanEtas([[null], [null]])).toEqual([null]);
  });

  it("uses the longest row length", () => {
    expect(meanEtas([[10], [20, 30]])).toEqual([15, 30]);
  });
});
