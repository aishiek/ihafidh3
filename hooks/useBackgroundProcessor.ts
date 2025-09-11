import { useState, useEffect, useCallback } from 'react';
import BackgroundProcessor, { BackgroundTask } from '@/utils/backgroundProcessor';

export const useBackgroundProcessor = () => {
  const [currentTask, setCurrentTask] = useState<BackgroundTask | null>(null);
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [allTasks, setAllTasks] = useState<BackgroundTask[]>([]);

  // Update state when processor changes
  useEffect(() => {
    const updateState = () => {
      const processor = BackgroundProcessor.getInstance();
      const current = processor.getCurrentTask();
      const tasks = processor.getAllTasks();
      
      setCurrentTask(current);
      setIsProcessing(processor.isAnyTaskRunning());
      setAllTasks(tasks);
    };

    // Initial update
    updateState();

    // Set up interval to check for updates
    const interval = setInterval(updateState, 500);

    return () => clearInterval(interval);
  }, []);

  // Start a background task
  const startTask = useCallback((
    type: 'memorize' | 'revise',
    surahId: number,
    surahName: string,
    totalVerses: number,
    isUnmarking: boolean
  ): string => {
    const processor = BackgroundProcessor.getInstance();
    
    const taskId = processor.addTask(
      type,
      surahId,
      surahName,
      totalVerses,
      isUnmarking,
      (progressValue) => {
        setProgress(progressValue);
      },
      (success, error) => {
        if (success) {
          console.log('Background task completed successfully');
        } else {
          console.error('Background task failed:', error);
        }
        // Reset progress after completion
        setTimeout(() => setProgress(0), 1000);
      }
    );

    return taskId;
  }, []);

  // Cancel current task
  const cancelCurrentTask = useCallback(() => {
    if (currentTask) {
      const processor = BackgroundProcessor.getInstance();
      processor.cancelTask(currentTask.id);
    }
  }, [currentTask]);

  // Clear completed tasks
  const clearCompletedTasks = useCallback(() => {
    const processor = BackgroundProcessor.getInstance();
    processor.clearCompletedTasks();
  }, []);

  // Get task by ID
  const getTask = useCallback((taskId: string): BackgroundTask | undefined => {
    const processor = BackgroundProcessor.getInstance();
    return processor.getTask(taskId);
  }, []);

  return {
    currentTask,
    progress,
    isProcessing,
    allTasks,
    startTask,
    cancelCurrentTask,
    clearCompletedTasks,
    getTask
  };
}; 