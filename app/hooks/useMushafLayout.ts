import LayoutService from '@/app/mushaf/services/layoutService';
import { LayoutMetadata, PageLayout } from '@/types/layout';
import { useEffect, useState } from 'react';

export const useMushafLayout = (initialPage: number = 1) => {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(0);
  const [pageLayout, setPageLayout] = useState<PageLayout[]>([]);
  const [activeLayout, setActiveLayout] = useState<LayoutMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { initialize(); }, []);
  useEffect(() => { if (!loading) loadPage(currentPage); }, [currentPage, loading]);

  const initialize = async () => {
    try {
      setLoading(true); setError(null);
      const success = await LayoutService.initializeDefaultLayout();
      if (!success) throw new Error('Failed to initialize layout');
      const layout = await LayoutService.getActiveLayout();
      setActiveLayout(layout);
      const total = await LayoutService.getTotalPages();
      setTotalPages(total);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  };

  const loadPage = async (pageNum: number) => {
    try {
      const layout = await LayoutService.getPageLayout(pageNum);
      setPageLayout(layout);
    } catch (err) {
      console.error('Error loading page:', err);
      setError('Failed to load page');
    }
  };

  const goToPage = (pageNum: number) => { if (pageNum >=1 && pageNum <= totalPages) setCurrentPage(pageNum); };
  const nextPage = () => { if (currentPage < totalPages) setCurrentPage(currentPage + 1); };
  const previousPage = () => { if (currentPage > 1) setCurrentPage(currentPage - 1); };

  const goToSurah = async (surahNumber: number) => {
    try { const startPage = await LayoutService.getSurahStartPage(surahNumber); setCurrentPage(startPage); } catch (err) { console.error('Error navigating to surah:', err); }
  };

  const changeLayout = async (layoutId: string) => {
    try {
      setLoading(true);
      const success = await LayoutService.setActiveLayout(layoutId);
      if (success) {
        const layout = await LayoutService.getActiveLayout(); setActiveLayout(layout);
        const total = await LayoutService.getTotalPages(); setTotalPages(total);
        setCurrentPage(1); await loadPage(1);
      }
      setLoading(false);
      return success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change layout');
      setLoading(false);
      return false;
    }
  };

  return { currentPage, totalPages, pageLayout, activeLayout, loading, error, goToPage, nextPage, previousPage, goToSurah, changeLayout };
};
