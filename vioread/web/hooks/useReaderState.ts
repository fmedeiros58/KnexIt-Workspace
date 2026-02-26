import { useReaderStore } from "../store/reader.store";

export function useReaderState() {
  return useReaderStore();
}

