import { describe, expect, it } from "vitest";
import { formatParticipantDisplayName } from "./formatParticipantDisplayName";

describe("formatParticipantDisplayName", () => {
  it("adds the female marker", () => {
    expect(formatParticipantDisplayName({ name: "佐藤", gender: "female" })).toBe("佐藤♀");
  });

  it("adds the male marker", () => {
    expect(formatParticipantDisplayName({ name: "鈴木", gender: "male" })).toBe("鈴木♂");
  });

  it("does not add a marker when gender is absent", () => {
    expect(formatParticipantDisplayName({ name: "Guest" })).toBe("Guest");
  });
});
