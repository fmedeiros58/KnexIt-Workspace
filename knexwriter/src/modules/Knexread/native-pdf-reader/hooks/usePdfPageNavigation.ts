import { useCallback, useState } from "react";

function clampPage(page: number, pageCount: number) {
  const safePageCount = Math.max(1, pageCount);
  return Math.max(1, Math.min(safePageCount, Math.round(page)));
}

export function usePdfPageNavigation(initialPageCount = 1, initialPage = 1) {
  const [pageCount, setPageCountState] = useState(Math.max(1, initialPageCount));
  const [page, setPageState] = useState(clampPage(initialPage, initialPageCount));

  const setPageCount = useCallback((nextPageCount: number) => {
    const safePageCount = Math.max(1, Math.round(nextPageCount));
    setPageCountState(safePageCount);
    setPageState((currentPage) => clampPage(currentPage, safePageCount));
  }, []);

  const goToPage = useCallback(
    (nextPage: number) => {
      setPageState(clampPage(nextPage, pageCount));
    },
    [pageCount],
  );

  const goToNextPage = useCallback(() => {
    setPageState((currentPage) => clampPage(currentPage + 1, pageCount));
  }, [pageCount]);

  const goToPreviousPage = useCallback(() => {
    setPageState((currentPage) => clampPage(currentPage - 1, pageCount));
  }, [pageCount]);

  return {
    page,
    pageCount,
    setPageCount,
    goToPage,
    goToNextPage,
    goToPreviousPage,
  };
}

