import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PdfMatchupResult } from "./buildPdfDocumentModel";
import { exportGuestMatchupPdf } from "./exportMatchupPdf";

type AutoTableCellHookData = {
  section: "body" | "head" | "foot";
  column: { index: number };
  cell: {
    height: number;
    raw: unknown;
    styles: Record<string, unknown>;
    text?: string[];
    width: number;
    x: number;
    y: number;
  };
};

type AutoTableOptions = {
  body?: string[][];
  didDrawCell?: (hookData: AutoTableCellHookData) => void;
  didParseCell?: (hookData: AutoTableCellHookData) => void;
};

const pdfMocks = vi.hoisted(() => {
  const docs: Array<ReturnType<typeof createMockPdfDoc>> = [];
  const autoTable = vi.fn((doc: unknown, options: AutoTableOptions) => {
    void doc;
    void options;
  });
  const jsPDF = vi.fn(function MockJsPdf() {
    const doc = createMockPdfDoc();
    docs.push(doc);
    return doc;
  });

  function createMockPdfDoc() {
    return {
      addFileToVFS: vi.fn(),
      addFont: vi.fn(),
      addPage: vi.fn(),
      getTextWidth: vi.fn((text: string) => text.length * 8),
      internal: {
        pageSize: {
          getHeight: () => 842,
          getWidth: () => 595,
        },
      },
      line: vi.fn(),
      roundedRect: vi.fn(),
      save: vi.fn(),
      setDrawColor: vi.fn(),
      setFillColor: vi.fn(),
      setFont: vi.fn(),
      setFontSize: vi.fn(),
      setLineWidth: vi.fn(),
      setTextColor: vi.fn(),
      text: vi.fn(),
    };
  }

  return { autoTable, docs, jsPDF };
});

vi.mock("jspdf", () => ({
  jsPDF: pdfMocks.jsPDF,
}));

vi.mock("jspdf-autotable", () => ({
  autoTable: pdfMocks.autoTable,
}));

function createBodyHookData(columnIndex: number, raw: string): AutoTableCellHookData {
  return {
    section: "body",
    column: { index: columnIndex },
    cell: {
      height: 64,
      raw,
      styles: {},
      text: [raw],
      width: 160,
      x: 40,
      y: 80,
    },
  };
}

describe("exportGuestMatchupPdf", () => {
  beforeEach(() => {
    pdfMocks.autoTable.mockClear();
    pdfMocks.docs.length = 0;
    pdfMocks.jsPDF.mockClear();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(1),
      })),
    );
    vi.stubGlobal("btoa", vi.fn(() => "AA=="));
  });

  it("keeps the Japanese PDF font for guest names in body and manual court text", async () => {
    const result: PdfMatchupResult = {
      conditions: {
        eventName: "Guest PDF",
        matchupMode: "standard",
        participants: [
          { id: "guest-01", name: "ゲスト01", gender: "female", index: 1 },
          { id: "guest-02", name: "ゲスト02", gender: "female", index: 2 },
          { id: "guest-03", name: "ゲスト03", gender: "male", index: 3 },
          { id: "guest-04", name: "ゲスト04", gender: "male", index: 4 },
          { id: "guest-05", name: "ゲスト05", gender: "male", index: 5 },
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
              pairA: { player1Id: "guest-01", player2Id: "guest-03" },
              pairB: { player1Id: "guest-02", player2Id: "guest-04" },
            },
          ],
          restPlayerIds: ["guest-05"],
        },
      ],
      seed: 100,
    };

    await exportGuestMatchupPdf(result);

    const options = pdfMocks.autoTable.mock.calls[0]?.[1];
    expect(options?.body?.[0]?.[1]).toContain("ゲスト01\u00a0F");
    expect(options?.body?.[0]?.[2]).toBe("ゲスト05\u00a0M");

    const courtText = "ゲスト01\u00a0F / ゲスト03\u00a0M\nゲスト02\u00a0F / ゲスト04\u00a0M";
    const courtHookData = createBodyHookData(1, courtText);
    options?.didParseCell?.(courtHookData);
    expect(courtHookData.cell.styles.font).toBe("NotoSansJP");

    const restHookData = createBodyHookData(2, "ゲスト05\u00a0M");
    options?.didParseCell?.(restHookData);
    expect(restHookData.cell.styles.font).toBe("NotoSansJP");

    options?.didDrawCell?.(courtHookData);
    expect(pdfMocks.docs[0]?.setFont).toHaveBeenLastCalledWith("NotoSansJP", "bold");
  });
});
