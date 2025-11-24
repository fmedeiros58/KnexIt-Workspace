export type DocumentSourceType = "supadrive" | "upload" | "rawText" | "url";

export type DocumentDescriptor = {
  id?: string;
  name: string;
  source: DocumentSourceType;
  payload?: any; // TODO: detalhar schema por origem (ex: supadriveId, file metadata)
};

export type VioReadBlockKind = "heading" | "paragraph" | "list" | "quote";

export type VioReadBlock = {
  id: string;
  kind: VioReadBlockKind;
  text: string;
  items?: string[];
};

export type VioReadSection = {
  id: string;
  title?: string;
  blocks: VioReadBlock[];
};

export type VioReadDocument = {
  id: string;
  title: string;
  language: string;
  summary?: string;
  sections: VioReadSection[];
};

