export type KnexWriterPdfIntegrationContext = {
  projectId: string;
  documentId?: string;
  sourceId?: string;
};

export function createKnexWriterPdfIntegrationContext(
  context: KnexWriterPdfIntegrationContext,
) {
  return context;
}
