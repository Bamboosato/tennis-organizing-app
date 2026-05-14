"use client";

import { useState } from "react";
import { exportGuestMatchupPdf, exportMatchupPdf } from "@/features/matchups/pdf/exportMatchupPdf";
import type { PdfMatchupResult } from "@/features/matchups/pdf/buildPdfDocumentModel";

export function useMatchupPdfExport() {
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfErrorMessage, setPdfErrorMessage] = useState<string | null>(null);

  async function exportPdf(result: PdfMatchupResult, options?: { isGuest?: boolean }) {
    setIsExportingPdf(true);
    setPdfErrorMessage(null);

    try {
      if (options?.isGuest) {
        await exportGuestMatchupPdf(result);
      } else {
        await exportMatchupPdf(result);
      }
    } catch (error) {
      console.error(error);
      setPdfErrorMessage("PDFを出力できませんでした。時間をおいて再試行してください。");
    } finally {
      setIsExportingPdf(false);
    }
  }

  function clearPdfError() {
    setPdfErrorMessage(null);
  }

  return {
    exportPdf,
    isExportingPdf,
    pdfErrorMessage,
    clearPdfError,
  };
}
