import { describe, expect, it } from "vitest";
import { buildGuestParticipants } from "./buildGuestParticipants";

describe("buildGuestParticipants", () => {
  it("keeps the existing Guest login number-and-gender display by default", () => {
    expect(buildGuestParticipants(2, 2)).toEqual([
      { id: "guest-01", name: "01F", gender: "female" },
      { id: "guest-02", name: "02F", gender: "female" },
      { id: "guest-03", name: "03M", gender: "male" },
      { id: "guest-04", name: "04M", gender: "male" },
    ]);
  });

  it("builds registered-user additional guests with female-first guest nicknames", () => {
    expect(buildGuestParticipants(2, 1, { idPrefix: "member-guest", nameStyle: "guestNickname" })).toEqual([
      { id: "member-guest-01", name: "ゲスト-01", gender: "female" },
      { id: "member-guest-02", name: "ゲスト-02", gender: "female" },
      { id: "member-guest-03", name: "ゲスト-03", gender: "male" },
    ]);
  });

  it("omits empty gender groups while keeping numbering sequential", () => {
    expect(buildGuestParticipants(0, 2, { idPrefix: "member-guest", nameStyle: "guestNickname" })).toEqual([
      { id: "member-guest-01", name: "ゲスト-01", gender: "male" },
      { id: "member-guest-02", name: "ゲスト-02", gender: "male" },
    ]);
  });
});
