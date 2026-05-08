import type {
  InsertCitationFromSourceInput,
  LinkSelectedTextToReferenceInput,
} from "../organization/organizationTypes";

export type WriterCommandMap = Record<string, (...args: unknown[]) => unknown>;

export type WriterInsertCitationFromSourceCommand = (input: InsertCitationFromSourceInput) => void;
export type WriterLinkSelectedTextToReferenceCommand = (input: LinkSelectedTextToReferenceInput) => void;
