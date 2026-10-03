import type { UserOptions } from "jspdf-autotable";

export type PdfTable = {
  title: string;
  subtitle?: string;
  filename: string;
  head: string[];
  body: string[][];
};

/** Helvetica only encodes WinAnsi. Keep Latin-1 and map common punctuation. */
function pdfText(value: string): string {
  return value
    .replace(/\u2014|\u2013/g, "-")
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201C|\u201D/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/[^\t\n\r\u0020-\u00FF]/g, "");
}

export async function downloadPdf(table: PdfTable): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const { autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 40;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(pdfText(table.title), margin, 48);

  let startY = 64;
  if (table.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(80);
    const lines = doc.splitTextToSize(pdfText(table.subtitle), 532);
    doc.text(lines, margin, 68);
    startY = 68 + lines.length * 14 + 8;
    doc.setTextColor(0);
  }

  const options: UserOptions = {
    startY,
    margin,
    head: [table.head.map(pdfText)],
    body: table.body.map((row) => row.map(pdfText)),
    styles: { font: "helvetica", fontSize: 11, cellPadding: 6 },
    headStyles: { fillColor: [20, 20, 20], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  };
  autoTable(doc, options);
  doc.save(safeFilename(table.filename));
}

function safeFilename(filename: string): string {
  const cleaned = filename.replace(/[^\w.\-]+/g, "-").replace(/-+/g, "-");
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned}.pdf`;
}
