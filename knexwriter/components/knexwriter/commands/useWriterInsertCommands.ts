import type {
  InsertCitationFromSourceInput,
  LinkSelectedTextToReferenceInput,
} from "../organization/organizationTypes";

export function useWriterInsertCommands() {
  return {
    insertCitationFromSource(_input: InsertCitationFromSourceInput) {
      // Real execution is provided by KnexWriterShell until the command layer receives editor state.
    },
    linkSelectedTextToReference(_input: LinkSelectedTextToReferenceInput) {
      // Real execution is provided by KnexWriterShell until the command layer receives editor state.
    },
  };
}
