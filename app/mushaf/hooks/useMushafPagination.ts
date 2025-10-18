import { useCallback, useState } from 'react';

export function useMushafPagination(initialPage: number = 1) {
  const [currentPage, setCurrentPage] = useState(initialPage);

  const goToPage = useCallback((page: number) => {
    const valid = Math.max(1, Math.min(610, page));
    setCurrentPage(valid);
  }, []);

  const nextPage = useCallback(() => setCurrentPage(p => Math.min(610, p + 1)), []);
  const prevPage = useCallback(() => setCurrentPage(p => Math.max(1, p - 1)), []);

  return { currentPage, goToPage, nextPage, prevPage };
}
