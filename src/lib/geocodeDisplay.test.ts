import { describe, expect, it } from "vitest";
import { formatGeocodeLabel, suggestContext } from "./geocodeDisplay";

describe("formatGeocodeLabel", () => {
  it("includes house number when present", () => {
    expect(formatGeocodeLabel("1550", "Soldiers Field Rd")).toBe(
      "1550 Soldiers Field Rd",
    );
  });

  it("uses text alone for POIs / places", () => {
    expect(formatGeocodeLabel(undefined, "Boston Common")).toBe("Boston Common");
  });
});

describe("suggestContext", () => {
  it("strips the primary label prefix from place_name", () => {
    expect(
      suggestContext(
        "1550 Soldiers Field Rd",
        "1550 Soldiers Field Rd, Boston, Massachusetts 02135, United States",
      ),
    ).toBe("Boston, Massachusetts 02135, United States");
  });

  it("returns place_name unchanged when prefix does not match", () => {
    expect(
      suggestContext("Boston Common", "Boston Common Park, Boston, MA"),
    ).toBe("Boston Common Park, Boston, MA");
  });
});
