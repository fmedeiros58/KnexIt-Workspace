import { useWriterFormattingCommands } from "./useWriterFormattingCommands";
import { useWriterInsertCommands } from "./useWriterInsertCommands";
import { useWriterLayoutCommands } from "./useWriterLayoutCommands";
import { useWriterProjectCommands } from "./useWriterProjectCommands";
import { useWriterViewCommands } from "./useWriterViewCommands";

export function useWriterCommands() {
  return {
    ...useWriterFormattingCommands(),
    ...useWriterLayoutCommands(),
    ...useWriterInsertCommands(),
    ...useWriterProjectCommands(),
    ...useWriterViewCommands(),
  };
}

