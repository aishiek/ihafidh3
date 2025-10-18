import { useEffect, useRef, useState } from 'react';

export function useBulkProgressModal() {
  const [modalVisible, setModalVisible] = useState(false);
  const [modalText, setModalText] = useState('');
  const [modalProgress, setModalProgress] = useState(0);
  const [modalTotal, setModalTotal] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const progressTimerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    };
  }, []);

  function startBulkOperation(text: string, total: number) {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    setModalText(text);
    setModalTotal(total);
    setModalProgress(0);
    setIsProcessing(true);
    setModalVisible(true);
  }

  function animateProgress(progress: number, total: number) {
    setModalProgress(progress);
    setModalTotal(total);
  }

  function resetModal() {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    setModalVisible(false);
    setModalText('');
    setModalProgress(0);
    setModalTotal(0);
    setIsProcessing(false);
  }

  function closeModal() {
    // small delay could be added by caller to show 100%
    resetModal();
  }

  return {
    modalVisible,
    modalText,
    modalProgress,
    modalTotal,
    isProcessing,
    setModalVisible,
    startBulkOperation,
    animateProgress,
    resetModal,
    closeModal,
    progressTimerRef,
  };
}
