"use client";

import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import type { CellInput } from "jspdf-autotable";
import {
  buildPdfDocumentModel,
  buildPdfFileName,
  PDF_COURTS_PER_ROW,
  truncateTextToWidth,
  type PdfCourtBlock,
  type PdfMatchupCourt,
  type PdfMatchupPair,
  type PdfMatchupParticipant,
  type PdfMatchupResult,
  type PdfRoundBlock,
} from "./buildPdfDocumentModel";

const PDF_FONT_URL = "/fonts/NotoSansJP-VF.ttf?v=20260512";
const PDF_FONT_FILE = "NotoSansJP-VF.ttf";
const PDF_FONT_FAMILY = "NotoSansJP";

const PAGE_MARGIN = 24;
const HEADER_TOP = 24;
const HEADER_BOTTOM = 66;
const FOOTER_HEIGHT = 40;
const META_CHIP_GAP = 6;
const META_CHIP_HEIGHT = 32;
const META_CHIP_WIDTH = 72;
const EMPHASIS_TEXT_COLOR: [number, number, number] = [15, 23, 42];
const SUBTLE_TEXT_COLOR: [number, number, number] = [71, 85, 105];
const BLUE_TEXT_COLOR: [number, number, number] = [29, 78, 216];
const BLUE_LINE_COLOR: [number, number, number] = [0, 112, 192];
const BLUE_FILL_COLOR: [number, number, number] = [232, 244, 255];
const COURT_HEADER_HEIGHT = 12;
const PLAYER_ROW_HEIGHT = 32;
const REST_HEADER_HEIGHT = 12;
const REST_ROW_HEIGHT = 18;
const HEADER_ROUND_GAP_HEIGHT = 9;
const ROUND_GAP_HEIGHT = 7;
const TABLE_LINE_WIDTH = 0.5;
const MATCHUP_APP_PDF_ROUNDS_PER_PAGE = 12;
const MATCHUP_APP_EMPHASIS_TEXT_COLOR: [number, number, number] = [24, 18, 12];
const MATCHUP_APP_SUBTLE_TEXT_COLOR: [number, number, number] = [117, 104, 88];
const MATCHUP_APP_LINE_COLOR: [number, number, number] = [154, 141, 122];
const MATCHUP_APP_FILL_COLOR: [number, number, number] = [247, 242, 233];
const MATCHUP_APP_ACCENT_COLOR: [number, number, number] = [216, 109, 63];
const MATCHUP_APP_COURT_CELL_FONT_SIZE_BOOST = 1.8;
const MATCHUP_APP_REST_CELL_FONT_SIZE_BOOST = 2.2;
const MATCHUP_APP_COURT_TEAM_GAP_RATIO = 0.5;

let fontBytesPromise: Promise<string> | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

async function loadPdfFontBytes() {
  if (!fontBytesPromise) {
    fontBytesPromise = fetch(PDF_FONT_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load PDF font: ${response.status}`);
        }

        return response.arrayBuffer();
      })
      .then((buffer) => arrayBufferToBase64(buffer));
  }

  return fontBytesPromise;
}

async function registerPdfFont(doc: jsPDF) {
  const fontBase64 = await loadPdfFontBytes();

  doc.addFileToVFS(PDF_FONT_FILE, fontBase64);
  doc.addFont(PDF_FONT_FILE, PDF_FONT_FAMILY, "normal", "Identity-H");
  doc.addFont(PDF_FONT_FILE, PDF_FONT_FAMILY, "bold", "Identity-H");
}

function pageWidth(doc: jsPDF) {
  return doc.internal.pageSize.getWidth();
}

function pageHeight(doc: jsPDF) {
  return doc.internal.pageSize.getHeight();
}

function drawMetaChip(
  doc: jsPDF,
  x: number,
  y: number,
  label: string,
  value: string,
  labelFontSize: number,
  valueFontSize: number,
) {
  doc.setFillColor(...BLUE_FILL_COLOR);
  doc.setDrawColor(...BLUE_LINE_COLOR);
  doc.roundedRect(x, y, META_CHIP_WIDTH, META_CHIP_HEIGHT, 4, 4, "FD");

  doc.setFont(PDF_FONT_FAMILY, "bold");
  doc.setFontSize(labelFontSize);
  doc.setTextColor(...SUBTLE_TEXT_COLOR);
  doc.text(label, x + 8, y + 10);

  doc.setFont(PDF_FONT_FAMILY, "bold");
  doc.setFontSize(valueFontSize);
  doc.setTextColor(...EMPHASIS_TEXT_COLOR);
  doc.text(value, x + 8, y + 24);
}

function drawHeader(doc: jsPDF, model: ReturnType<typeof buildPdfDocumentModel>) {
  const width = pageWidth(doc);
  const chipTotalWidth = META_CHIP_WIDTH * 4 + META_CHIP_GAP * 3;
  const chipStartX = width - PAGE_MARGIN - chipTotalWidth;
  const titleMaxWidth = chipStartX - PAGE_MARGIN - 12;

  doc.setFont(PDF_FONT_FAMILY, "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BLUE_TEXT_COLOR);
  doc.text("MATCHUP SHEET", PAGE_MARGIN, HEADER_TOP);

  doc.setFontSize(model.typography.titleFontSize);
  doc.setTextColor(...EMPHASIS_TEXT_COLOR);
  const eventName = truncateTextToWidth(model.eventName, titleMaxWidth, (candidate) => doc.getTextWidth(candidate));
  doc.text(eventName, PAGE_MARGIN, HEADER_TOP + 24);

  drawMetaChip(
    doc,
    chipStartX,
    HEADER_TOP - 8,
    "ROUNDS",
    String(model.roundCount),
    model.typography.metaLabelFontSize,
    model.typography.metaValueFontSize,
  );
  drawMetaChip(
    doc,
    chipStartX + META_CHIP_WIDTH + META_CHIP_GAP,
    HEADER_TOP - 8,
    "COURTS",
    String(model.courtCount),
    model.typography.metaLabelFontSize,
    model.typography.metaValueFontSize,
  );
  drawMetaChip(
    doc,
    chipStartX + (META_CHIP_WIDTH + META_CHIP_GAP) * 2,
    HEADER_TOP - 8,
    "PLAYERS",
    String(model.participantCount),
    model.typography.metaLabelFontSize,
    model.typography.metaValueFontSize,
  );
  drawMetaChip(
    doc,
    chipStartX + (META_CHIP_WIDTH + META_CHIP_GAP) * 3,
    HEADER_TOP - 8,
    "SEED",
    String(model.seed),
    model.typography.metaLabelFontSize,
    Math.max(10, model.typography.metaValueFontSize - 3),
  );

  doc.setDrawColor(...BLUE_LINE_COLOR);
  doc.setLineWidth(1.2);
  doc.line(PAGE_MARGIN, HEADER_BOTTOM, width - PAGE_MARGIN, HEADER_BOTTOM);
}

function drawFooter(doc: jsPDF, pageNumber: number, totalPages: number) {
  const width = pageWidth(doc);
  const height = pageHeight(doc);

  doc.setFont(PDF_FONT_FAMILY, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...SUBTLE_TEXT_COLOR);
  doc.text("tennis-organizing-app", PAGE_MARGIN, height - PAGE_MARGIN + 2);

  doc.setFont(PDF_FONT_FAMILY, "bold");
  doc.setFontSize(9);
  doc.setTextColor(...EMPHASIS_TEXT_COLOR);
  doc.text(`${pageNumber} / ${totalPages}`, width / 2, height - PAGE_MARGIN + 2, {
    align: "center",
  });
}

function drawMatchupAppMetaChip(
  doc: jsPDF,
  x: number,
  y: number,
  label: string,
  value: string,
  labelFontSize: number,
  valueFontSize: number,
) {
  doc.setFillColor(242, 234, 223);
  doc.setDrawColor(207, 198, 183);
  doc.roundedRect(x, y, 78, META_CHIP_HEIGHT, 4, 4, "FD");

  doc.setFont(PDF_FONT_FAMILY, "bold");
  doc.setFontSize(labelFontSize);
  doc.setTextColor(...MATCHUP_APP_SUBTLE_TEXT_COLOR);
  doc.text(label, x + 8, y + 10);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(valueFontSize);
  doc.setTextColor(...MATCHUP_APP_EMPHASIS_TEXT_COLOR);
  doc.text(value, x + 8, y + 24);
}

function drawMatchupAppHeader(doc: jsPDF, model: MatchupAppPdfDocumentModel) {
  const width = pageWidth(doc);
  const chipWidth = 78;
  const chipTotalWidth = chipWidth * 3 + META_CHIP_GAP * 2;
  const chipStartX = width - PAGE_MARGIN - chipTotalWidth;
  const titleMaxWidth = chipStartX - PAGE_MARGIN - 12;

  doc.setFont(PDF_FONT_FAMILY, "bold");
  doc.setFontSize(10);
  doc.setTextColor(...MATCHUP_APP_ACCENT_COLOR);
  doc.text("MATCHUP SHEET", PAGE_MARGIN, HEADER_TOP);

  doc.setFontSize(model.typography.titleFontSize);
  doc.setTextColor(46, 38, 29);
  const eventName = truncateTextToWidth(model.eventName, titleMaxWidth, (candidate) => doc.getTextWidth(candidate));
  doc.text(eventName, PAGE_MARGIN, HEADER_TOP + 24);

  drawMatchupAppMetaChip(
    doc,
    chipStartX,
    HEADER_TOP - 8,
    "ROUNDS",
    String(model.roundCount),
    model.typography.metaLabelFontSize,
    model.typography.metaValueFontSize,
  );
  drawMatchupAppMetaChip(
    doc,
    chipStartX + chipWidth + META_CHIP_GAP,
    HEADER_TOP - 8,
    "COURTS",
    String(model.courtCount),
    model.typography.metaLabelFontSize,
    model.typography.metaValueFontSize,
  );
  drawMatchupAppMetaChip(
    doc,
    chipStartX + (chipWidth + META_CHIP_GAP) * 2,
    HEADER_TOP - 8,
    "PLAYERS",
    String(model.participantCount),
    model.typography.metaLabelFontSize,
    model.typography.metaValueFontSize,
  );

  doc.setDrawColor(...MATCHUP_APP_LINE_COLOR);
  doc.setLineWidth(1.2);
  doc.line(PAGE_MARGIN, HEADER_BOTTOM, width - PAGE_MARGIN, HEADER_BOTTOM);
}

function drawMatchupAppFooter(doc: jsPDF, pageNumber: number, totalPages: number) {
  const width = pageWidth(doc);
  const height = pageHeight(doc);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...MATCHUP_APP_EMPHASIS_TEXT_COLOR);
  doc.text(`${pageNumber} / ${totalPages}`, width / 2, height - PAGE_MARGIN + 2, {
    align: "center",
  });
}

type MatchupAppPdfTypography = {
  titleFontSize: number;
  metaLabelFontSize: number;
  metaValueFontSize: number;
  tableHeaderFontSize: number;
  tableBodyFontSize: number;
  roundFontSize: number;
};

type MatchupAppPdfTableRow = {
  roundLabel: string;
  courtCells: string[];
  restCell: string;
};

type MatchupAppPdfDocumentModel = {
  eventName: string;
  roundCount: number;
  courtCount: number;
  participantCount: number;
  pages: Array<{
    pageNumber: number;
    rows: MatchupAppPdfTableRow[];
  }>;
  typography: MatchupAppPdfTypography;
};

function pickMatchupAppPdfTypography(params: {
  courtCount: number;
  participantCount: number;
  roundsOnPage: number;
}): MatchupAppPdfTypography {
  const densityRounds = Math.min(params.roundsOnPage, 10);
  const densityScore =
    Math.max(0, params.courtCount - 2) * 1.2 +
    Math.max(0, densityRounds - 6) * 0.35 +
    Math.max(0, params.participantCount - 8) * 0.12;

  const tableBodyFontSize = Math.max(7.2, 10.6 - densityScore);
  const tableHeaderFontSize = Math.max(7.8, tableBodyFontSize + 0.4);
  const roundFontSize = Math.max(8, tableBodyFontSize + 0.8);
  const titleFontSize = params.courtCount >= 4 ? 18 : 20;
  const metaValueFontSize = params.courtCount >= 4 ? 14 : 16;

  return {
    titleFontSize,
    metaLabelFontSize: 8,
    metaValueFontSize,
    tableHeaderFontSize,
    tableBodyFontSize,
    roundFontSize,
  };
}

function createMatchupAppParticipantNameMap(participants: PdfMatchupParticipant[]) {
  return new Map(participants.map((participant) => [participant.id, participant.name]));
}

function createMatchupAppParticipantOrderMap(participants: PdfMatchupParticipant[]) {
  return new Map(participants.map((participant, index) => [participant.id, participant.index ?? index + 1]));
}

function formatMatchupAppPair(
  pair: PdfMatchupPair,
  participantNameById: Map<string, string>,
  participantOrderById: Map<string, number>,
) {
  return [pair.player1Id, pair.player2Id]
    .map((playerId, order) => ({
      label: participantNameById.get(playerId) ?? playerId,
      order,
      sortIndex: participantOrderById.get(playerId) ?? Number.MAX_SAFE_INTEGER,
    }))
    .sort((left, right) => {
      if (left.sortIndex !== right.sortIndex) {
        return left.sortIndex - right.sortIndex;
      }

      return left.order - right.order;
    })
    .map((player) => player.label)
    .join(" / ");
}

function formatMatchupAppCourtCell(
  court: PdfMatchupCourt,
  participantNameById: Map<string, string>,
  participantOrderById: Map<string, number>,
) {
  if (court.isUnused || !court.pairA || !court.pairB) {
    return "未使用";
  }

  return [
    formatMatchupAppPair(court.pairA, participantNameById, participantOrderById),
    formatMatchupAppPair(court.pairB, participantNameById, participantOrderById),
  ].join("\n");
}

function formatMatchupAppRestCell(
  restPlayerIds: string[],
  participantNameById: Map<string, string>,
  participantOrderById: Map<string, number>,
) {
  if (restPlayerIds.length === 0) {
    return "-";
  }

  return restPlayerIds
    .slice()
    .sort((left, right) => {
      return (
        (participantOrderById.get(left) ?? Number.MAX_SAFE_INTEGER) -
        (participantOrderById.get(right) ?? Number.MAX_SAFE_INTEGER)
      );
    })
    .map((playerId) => participantNameById.get(playerId) ?? playerId)
    .join(", ");
}

function buildMatchupAppPdfDocumentModel(result: PdfMatchupResult): MatchupAppPdfDocumentModel {
  const participantNameById = createMatchupAppParticipantNameMap(result.conditions.participants);
  const participantOrderById = createMatchupAppParticipantOrderMap(result.conditions.participants);
  const rows = result.rounds.map((round) => ({
    roundLabel: String(round.roundNumber),
    courtCells: round.courts.map((court) =>
      formatMatchupAppCourtCell(court, participantNameById, participantOrderById),
    ),
    restCell: formatMatchupAppRestCell(round.restPlayerIds, participantNameById, participantOrderById),
  }));
  const pages = [];

  for (let offset = 0; offset < rows.length; offset += MATCHUP_APP_PDF_ROUNDS_PER_PAGE) {
    pages.push({
      pageNumber: pages.length + 1,
      rows: rows.slice(offset, offset + MATCHUP_APP_PDF_ROUNDS_PER_PAGE),
    });
  }

  return {
    eventName: result.conditions.eventName || "テニス対戦組合せApp",
    roundCount: result.conditions.roundCount,
    courtCount: result.conditions.courtCount,
    participantCount: result.conditions.participants.length,
    pages,
    typography: pickMatchupAppPdfTypography({
      courtCount: result.conditions.courtCount,
      participantCount: result.conditions.participants.length,
      roundsOnPage: Math.min(MATCHUP_APP_PDF_ROUNDS_PER_PAGE, result.conditions.roundCount),
    }),
  };
}

function buildMatchupAppColumnStyles(doc: jsPDF, courtCount: number, participantCount: number) {
  const usableWidth = pageWidth(doc) - PAGE_MARGIN * 2;
  const roundColumnWidth = 30;
  const restColumnWidth = participantCount >= 12 ? 86 : participantCount >= 8 ? 72 : 60;
  const courtColumnWidth = (usableWidth - roundColumnWidth - restColumnWidth) / courtCount;
  const styles: Record<number, { cellWidth: number; halign?: "center" | "left" | "right" }> = {
    0: { cellWidth: roundColumnWidth, halign: "center" },
  };

  styles[courtCount + 1] = { cellWidth: restColumnWidth, halign: "center" };

  for (let index = 1; index <= courtCount; index += 1) {
    styles[index] = { cellWidth: courtColumnWidth };
  }

  return styles;
}

function buildColumnStyles(doc: jsPDF, teamColumnCount: number) {
  const usableWidth = pageWidth(doc) - PAGE_MARGIN * 2;
  const roundColumnWidth = 26;
  const teamColumnWidth = (usableWidth - roundColumnWidth) / teamColumnCount;
  const styles: Record<number, { cellWidth: number; halign?: "center" | "left" | "right" }> = {
    0: { cellWidth: roundColumnWidth, halign: "center" },
  };

  for (let index = 1; index <= teamColumnCount; index += 1) {
    styles[index] = { cellWidth: teamColumnWidth, halign: "center" };
  }

  return styles;
}

function tableCell(
  content: string | string[] | number,
  options?: { colSpan?: number; rowSpan?: number; minCellHeight?: number },
): CellInput {
  return {
    content,
    colSpan: options?.colSpan,
    rowSpan: options?.rowSpan,
    styles: {
      cellPadding: { top: 2, right: 3, bottom: 2, left: 3 },
      font: PDF_FONT_FAMILY,
      fontStyle: "normal",
      halign: "center",
      lineColor: BLUE_LINE_COLOR,
      lineWidth: TABLE_LINE_WIDTH,
      minCellHeight: options?.minCellHeight,
      overflow: "ellipsize",
      textColor: EMPHASIS_TEXT_COLOR,
      valign: "middle",
    },
  };
}

function roundCell(roundNumber: number, rowSpan: number): CellInput {
  return {
    content: String(roundNumber),
    rowSpan,
    styles: {
      cellPadding: 0,
      fillColor: BLUE_FILL_COLOR,
      font: PDF_FONT_FAMILY,
      fontStyle: "bold",
      fontSize: 9,
      halign: "center",
      lineColor: BLUE_LINE_COLOR,
      lineWidth: TABLE_LINE_WIDTH,
      textColor: EMPHASIS_TEXT_COLOR,
      valign: "middle",
    },
  };
}

function courtHeaderCell(court: PdfCourtBlock | null): CellInput {
  return {
    content: court ? `コート${court.courtNumber}` : "",
    colSpan: 2,
    styles: {
      cellPadding: { top: 1, right: 2, bottom: 1, left: 2 },
      font: PDF_FONT_FAMILY,
      fontStyle: "bold",
      fontSize: 8.2,
      halign: "center",
      lineColor: BLUE_LINE_COLOR,
      lineWidth: TABLE_LINE_WIDTH,
      minCellHeight: COURT_HEADER_HEIGHT,
      overflow: "ellipsize",
      textColor: EMPHASIS_TEXT_COLOR,
      valign: "middle",
    },
  };
}

function playerCell(players: string[]) {
  return tableCell(players.filter(Boolean).join("\n"), { minCellHeight: PLAYER_ROW_HEIGHT });
}

function emptyPlayerCells() {
  return [tableCell("", { minCellHeight: PLAYER_ROW_HEIGHT }), tableCell("", { minCellHeight: PLAYER_ROW_HEIGHT })];
}

function restHeaderCell(teamColumnCount: number): CellInput {
  return {
    content: "休憩",
    colSpan: teamColumnCount,
    styles: {
      cellPadding: { top: 1, right: 2, bottom: 1, left: 2 },
      font: PDF_FONT_FAMILY,
      fontStyle: "bold",
      fontSize: 8.4,
      halign: "center",
      lineColor: BLUE_LINE_COLOR,
      lineWidth: TABLE_LINE_WIDTH,
      minCellHeight: REST_HEADER_HEIGHT,
      textColor: EMPHASIS_TEXT_COLOR,
      valign: "middle",
    },
  };
}

function restPlayersCell(restCell: string, teamColumnCount: number): CellInput {
  return {
    content: restCell,
    colSpan: teamColumnCount,
    styles: {
      cellPadding: { top: 3, right: 4, bottom: 3, left: 4 },
      font: PDF_FONT_FAMILY,
      fontStyle: "normal",
      fontSize: 8.5,
      halign: "center",
      lineColor: BLUE_LINE_COLOR,
      lineWidth: TABLE_LINE_WIDTH,
      minCellHeight: REST_ROW_HEIGHT,
      overflow: "ellipsize",
      textColor: EMPHASIS_TEXT_COLOR,
      valign: "middle",
    },
  };
}

function spacerRowCell(totalColumnCount: number, height = ROUND_GAP_HEIGHT): CellInput {
  return {
    content: "",
    colSpan: totalColumnCount,
    styles: {
      cellPadding: 0,
      fillColor: false,
      lineColor: false,
      lineWidth: 0,
      minCellHeight: height,
      textColor: [255, 255, 255],
    },
  };
}

function courtPlayerCells(court: PdfCourtBlock | null) {
  if (!court) {
    return emptyPlayerCells();
  }

  return [playerCell(court.pairAPlayers), playerCell(court.pairBPlayers)];
}

function buildRoundRows(round: PdfRoundBlock, teamColumnCount: number, includeSpacer: boolean) {
  const rows: CellInput[][] = [];
  const rowSpan = round.courtRows.length * 2 + 2;

  round.courtRows.forEach(([leftCourt, rightCourt], rowIndex) => {
    const headerRow: CellInput[] = [];

    if (rowIndex === 0) {
      headerRow.push(roundCell(round.roundNumber, rowSpan));
    }

    headerRow.push(courtHeaderCell(leftCourt));
    if (teamColumnCount > 2) {
      headerRow.push(courtHeaderCell(rightCourt));
    }
    rows.push(headerRow);

    const playerRow: CellInput[] = [];
    playerRow.push(...courtPlayerCells(leftCourt));
    if (teamColumnCount > 2) {
      playerRow.push(...courtPlayerCells(rightCourt));
    }
    rows.push(playerRow);
  });

  rows.push([restHeaderCell(teamColumnCount)]);
  rows.push([restPlayersCell(round.restCell, teamColumnCount)]);

  if (includeSpacer) {
    rows.push([spacerRowCell(teamColumnCount + 1)]);
  }

  return rows;
}

export async function exportMatchupPdf(result: PdfMatchupResult) {
  const model = buildPdfDocumentModel(result);
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  });

  await registerPdfFont(doc);

  model.pages.forEach((page, pageIndex) => {
    const courtSlotCount = Math.min(Math.max(model.courtCount, 1), PDF_COURTS_PER_ROW);
    const teamColumnCount = courtSlotCount * 2;
    const bodyRows = [
      [spacerRowCell(teamColumnCount + 1, HEADER_ROUND_GAP_HEIGHT)],
      ...page.rounds.flatMap((round, roundIndex) =>
        buildRoundRows(round, teamColumnCount, roundIndex < page.rounds.length - 1),
      ),
    ];

    if (pageIndex > 0) {
      doc.addPage("a4", "portrait");
    }

    drawHeader(doc, model);

    autoTable(doc, {
      startY: HEADER_BOTTOM + 14,
      margin: {
        top: HEADER_BOTTOM + 14,
        right: PAGE_MARGIN,
        bottom: FOOTER_HEIGHT,
        left: PAGE_MARGIN,
      },
      theme: "grid",
      tableWidth: pageWidth(doc) - PAGE_MARGIN * 2,
      head: [["R", ...Array.from({ length: courtSlotCount }, () => ["A", "B"]).flat()]],
      body: bodyRows,
      styles: {
        font: PDF_FONT_FAMILY,
        fontStyle: "normal",
        fontSize: model.typography.tableBodyFontSize,
        cellPadding: { top: 2, right: 3, bottom: 2, left: 3 },
        lineColor: BLUE_LINE_COLOR,
        lineWidth: TABLE_LINE_WIDTH,
        textColor: EMPHASIS_TEXT_COLOR,
        valign: "middle",
        overflow: "ellipsize",
      },
      headStyles: {
        fillColor: BLUE_FILL_COLOR,
        textColor: BLUE_TEXT_COLOR,
        font: PDF_FONT_FAMILY,
        fontStyle: "bold",
        fontSize: 8.6,
        halign: "center",
        lineColor: BLUE_LINE_COLOR,
        lineWidth: TABLE_LINE_WIDTH,
        minCellHeight: 17,
        valign: "middle",
      },
      bodyStyles: {
        minCellHeight: 16,
      },
      columnStyles: buildColumnStyles(doc, teamColumnCount),
      tableLineColor: BLUE_LINE_COLOR,
      tableLineWidth: 0,
    });

    drawFooter(doc, page.pageNumber, model.pages.length);
  });

  doc.save(buildPdfFileName(result));
}

export async function exportGuestMatchupPdf(result: PdfMatchupResult) {
  const model = buildMatchupAppPdfDocumentModel(result);
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  });

  await registerPdfFont(doc);

  model.pages.forEach((page, pageIndex) => {
    if (pageIndex > 0) {
      doc.addPage("a4", "portrait");
    }

    drawMatchupAppHeader(doc, model);

    autoTable(doc, {
      startY: HEADER_BOTTOM + 14,
      margin: {
        top: HEADER_BOTTOM + 14,
        right: PAGE_MARGIN,
        bottom: FOOTER_HEIGHT,
        left: PAGE_MARGIN,
      },
      theme: "grid",
      tableWidth: pageWidth(doc) - PAGE_MARGIN * 2,
      head: [["R", ...Array.from({ length: model.courtCount }, (_, index) => `コート${index + 1}`), "休憩"]],
      body: page.rows.map((row) => [row.roundLabel, ...row.courtCells, row.restCell]),
      styles: {
        font: PDF_FONT_FAMILY,
        fontStyle: "normal",
        fontSize: model.typography.tableBodyFontSize,
        cellPadding: { top: 6, right: 6, bottom: 6, left: 6 },
        lineColor: [207, 198, 183],
        lineWidth: 0.6,
        textColor: [46, 38, 29],
        valign: "middle",
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: MATCHUP_APP_FILL_COLOR,
        textColor: MATCHUP_APP_SUBTLE_TEXT_COLOR,
        font: PDF_FONT_FAMILY,
        fontStyle: "bold",
        fontSize: model.typography.tableHeaderFontSize,
        halign: "center",
      },
      bodyStyles: {
        minCellHeight: 48,
      },
      columnStyles: buildMatchupAppColumnStyles(doc, model.courtCount, model.participantCount),
      didParseCell: (hookData) => {
        if (hookData.section !== "body") {
          return;
        }

        if (hookData.column.index === 0) {
          hookData.cell.styles.font = "helvetica";
          hookData.cell.styles.fontStyle = "bold";
          hookData.cell.styles.fontSize = model.typography.roundFontSize;
          hookData.cell.styles.halign = "center";
          hookData.cell.styles.textColor = MATCHUP_APP_EMPHASIS_TEXT_COLOR;
          return;
        }

        const cellText = hookData.cell.raw instanceof Array
          ? hookData.cell.raw.join("")
          : String(hookData.cell.raw ?? "");

        if (cellText === "未使用") {
          hookData.cell.styles.textColor = MATCHUP_APP_SUBTLE_TEXT_COLOR;
          hookData.cell.styles.halign = "center";
          hookData.cell.styles.fontStyle = "bold";
          hookData.cell.styles.font = PDF_FONT_FAMILY;
          return;
        }

        hookData.cell.styles.font = "helvetica";
        hookData.cell.styles.fontStyle = "bold";
        hookData.cell.styles.fontSize =
          model.typography.tableBodyFontSize +
          (hookData.column.index === model.courtCount + 1
            ? MATCHUP_APP_REST_CELL_FONT_SIZE_BOOST
            : MATCHUP_APP_COURT_CELL_FONT_SIZE_BOOST);
        hookData.cell.styles.textColor = MATCHUP_APP_EMPHASIS_TEXT_COLOR;

        if (hookData.column.index >= 1 && hookData.column.index <= model.courtCount) {
          hookData.cell.styles.halign = "center";
          hookData.cell.text = [""];
        }

        if (hookData.column.index === model.courtCount + 1) {
          hookData.cell.styles.halign = "center";
        }
      },
      didDrawCell: (hookData) => {
        if (hookData.section !== "body") {
          return;
        }

        if (hookData.column.index < 1 || hookData.column.index > model.courtCount) {
          return;
        }

        const cellText = String(hookData.cell.raw ?? "");

        if (!cellText || cellText === "未使用") {
          return;
        }

        const lines = cellText.split("\n");

        if (lines.length !== 2) {
          return;
        }

        const fontSize = model.typography.tableBodyFontSize + MATCHUP_APP_COURT_CELL_FONT_SIZE_BOOST;
        const lineGap = fontSize * MATCHUP_APP_COURT_TEAM_GAP_RATIO;
        const totalTextHeight = fontSize * lines.length + lineGap;
        const firstBaselineY =
          hookData.cell.y + (hookData.cell.height - totalTextHeight) / 2 + fontSize * 0.9;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(fontSize);
        doc.setTextColor(...MATCHUP_APP_EMPHASIS_TEXT_COLOR);
        doc.text(lines[0], hookData.cell.x + hookData.cell.width / 2, firstBaselineY, {
          align: "center",
        });
        doc.text(
          lines[1],
          hookData.cell.x + hookData.cell.width / 2,
          firstBaselineY + fontSize + lineGap,
          {
            align: "center",
          },
        );
      },
    });

    drawMatchupAppFooter(doc, page.pageNumber, model.pages.length);
  });

  doc.save(buildPdfFileName(result));
}
