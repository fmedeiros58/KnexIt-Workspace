export function buildPdfPageKey(pdfFileId: string, pageNumber: number) {
  return `${pdfFileId}::page-${pageNumber}`;
}

