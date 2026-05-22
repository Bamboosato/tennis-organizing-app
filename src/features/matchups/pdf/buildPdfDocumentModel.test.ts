import { describe, expect, it } from "vitest";
import { buildPdfDocumentModel, type PdfMatchupResult } from "./buildPdfDocumentModel";

describe("buildPdfDocumentModel", () => {
  it("uses gender-marked participant names for registered-user PDF cells", () => {
    const result: PdfMatchupResult = {
      conditions: {
        eventName: "PDF gender markers",
        matchupMode: "standard",
        participants: [
          { id: "p1", name: "佐藤", gender: "female", index: 1 },
          { id: "p2", name: "鈴木", gender: "male", index: 2 },
          { id: "p3", name: "高橋", gender: "female", index: 3 },
          { id: "p4", name: "田中", gender: "male", index: 4 },
          { id: "p5", name: "中村", gender: "female", index: 5 },
        ],
        courtCount: 1,
        roundCount: 1,
      },
      rounds: [
        {
          roundNumber: 1,
          courts: [
            {
              courtNumber: 1,
              pairA: { player1Id: "p1", player2Id: "p2" },
              pairB: { player1Id: "p3", player2Id: "p4" },
            },
          ],
          restPlayerIds: ["p5"],
        },
      ],
      seed: 1234,
    };

    const model = buildPdfDocumentModel(result);
    const court = model.pages[0].rounds[0].courtRows[0][0];

    expect(court?.pairAPlayers).toEqual(["佐藤\u00a0F", "鈴木\u00a0M"]);
    expect(court?.pairBPlayers).toEqual(["高橋\u00a0F", "田中\u00a0M"]);
    expect(model.pages[0].rounds[0].restCell).toBe("中村\u00a0F");
  });

  it("uses gender-marked additional guest names for registered-user PDF cells", () => {
    const result: PdfMatchupResult = {
      conditions: {
        eventName: "PDF guest markers",
        matchupMode: "standard",
        participants: [
          { id: "member-guest-01", name: "ゲスト-01", gender: "female", index: 1 },
          { id: "member-guest-02", name: "ゲスト-02", gender: "female", index: 2 },
          { id: "member-guest-03", name: "ゲスト-03", gender: "male", index: 3 },
          { id: "member-guest-04", name: "ゲスト-04", gender: "male", index: 4 },
        ],
        courtCount: 1,
        roundCount: 1,
      },
      rounds: [
        {
          roundNumber: 1,
          courts: [
            {
              courtNumber: 1,
              pairA: { player1Id: "member-guest-01", player2Id: "member-guest-03" },
              pairB: { player1Id: "member-guest-02", player2Id: "member-guest-04" },
            },
          ],
          restPlayerIds: [],
        },
      ],
      seed: 5678,
    };

    const model = buildPdfDocumentModel(result);
    const court = model.pages[0].rounds[0].courtRows[0][0];

    expect(court?.pairAPlayers).toEqual(["ゲスト-01\u00a0F", "ゲスト-03\u00a0M"]);
    expect(court?.pairBPlayers).toEqual(["ゲスト-02\u00a0F", "ゲスト-04\u00a0M"]);
  });
});
