import { useProgressStore } from '@/store/progressStore';
import { surahsData } from '@/data/surahs';

export interface BackgroundTask {
  id: string;
  type: 'memorize' | 'revise';
  surahId: number;
  surahName: string;
  totalVerses: number;
  processedVerses: number;
  isUnmarking: boolean;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  error?: string;
  startTime: number;
  endTime?: number;
}

class BackgroundProcessor {
  private static instance: BackgroundProcessor;
  private tasks: Map<string, BackgroundTask> = new Map();
  private isProcessing = false;
  private currentTaskId: string | null = null;
  private progressCallbacks: Map<string, (progress: number) => void> = new Map();
  private completionCallbacks: Map<string, (success: boolean, error?: string) => void> = new Map();

  private constructor() {}

  static getInstance(): BackgroundProcessor {
    if (!BackgroundProcessor.instance) {
      BackgroundProcessor.instance = new BackgroundProcessor();
    }
    return BackgroundProcessor.instance;
  }

  addTask(
    type: 'memorize' | 'revise',
    surahId: number,
    surahName: string,
    totalVerses: number,
    isUnmarking: boolean,
    onProgress?: (progress: number) => void,
    onComplete?: (success: boolean, error?: string) => void
  ): string {
    const taskId = `${type}_${surahId}_${Date.now()}`;
    
    const task: BackgroundTask = {
      id: taskId,
      type,
      surahId,
      surahName,
      totalVerses,
      processedVerses: 0,
      isUnmarking,
      status: 'pending',
      startTime: Date.now()
    };

    this.tasks.set(taskId, task);
    
    if (onProgress) {
      this.progressCallbacks.set(taskId, onProgress);
    }
    
    if (onComplete) {
      this.completionCallbacks.set(taskId, onComplete);
    }

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processNextTask();
    }

    return taskId;
  }

  getTask(taskId: string): BackgroundTask | undefined {
    return this.tasks.get(taskId);
  }

  getAllTasks(): BackgroundTask[] {
    return Array.from(this.tasks.values());
  }

  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (task && task.status === 'pending') {
      task.status = 'cancelled';
      task.endTime = Date.now();
      
      const callback = this.completionCallbacks.get(taskId);
      if (callback) {
        callback(false, 'Task cancelled');
      }
      
      return true;
    }
    return false;
  }

  clearCompletedTasks(): void {
    for (const [taskId, task] of this.tasks.entries()) {
      if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
        this.tasks.delete(taskId);
        this.progressCallbacks.delete(taskId);
        this.completionCallbacks.delete(taskId);
      }
    }
  }

  private async processNextTask(): Promise<void> {
    if (this.isProcessing) return;

    const pendingTask = Array.from(this.tasks.values()).find(task => task.status === 'pending');
    if (!pendingTask) return;

    this.isProcessing = true;
    this.currentTaskId = pendingTask.id;
    
    try {
      await this.processTask(pendingTask);
    } finally {
      this.isProcessing = false;
      this.currentTaskId = null;
      
      // Process next task if available
      setTimeout(() => this.processNextTask(), 100);
    }
  }

  private async processTask(task: BackgroundTask): Promise<void> {
    try {
      task.status = 'running';
      task.startTime = Date.now();
      
      console.log(`Starting background ${task.type} task for surah ${task.surahName}`);
      
      const verseIds = this.getSurahVerseIds(task.surahId);
      const chunkSize = 10; // Process 10 verses at a time
      
      for (let i = 0; i < verseIds.length; i += chunkSize) {
        const chunk = verseIds.slice(i, i + chunkSize);
        await this.processVerseChunk(task, chunk);
        
        task.processedVerses += chunk.length;
        const progress = (task.processedVerses / task.totalVerses) * 100;
        
        const callback = this.progressCallbacks.get(task.id);
        if (callback) {
          callback(progress);
        }
        
        // Small delay to prevent blocking the UI
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      task.status = 'completed';
      task.endTime = Date.now();
      
      console.log(`Completed background ${task.type} task for surah ${task.surahName}`);
      
      const callback = this.completionCallbacks.get(task.id);
      if (callback) {
        callback(true);
      }

    } catch (error) {
      console.error(`Background task error for surah ${task.surahName}:`, error);
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Unknown error';
      task.endTime = Date.now();
      
      const callback = this.completionCallbacks.get(task.id);
      if (callback) {
        callback(false, task.error);
      }
    }
  }

  // Process a chunk of verses
  private async processVerseChunk(task: BackgroundTask, verseIds: number[]): Promise<void> {
    const { markVerseAsMemorized, unmarkVerseAsMemorized, markVerseAsRevised } = useProgressStore.getState();
    const { memorizedVerses, revisedVerses } = useProgressStore.getState();

    for (const verseId of verseIds) {
      try {
        if (task.type === 'memorize') {
          if (task.isUnmarking) {
            if (memorizedVerses.includes(verseId)) {
              unmarkVerseAsMemorized(verseId);
            }
          } else {
            if (!memorizedVerses.includes(verseId)) {
              markVerseAsMemorized(verseId);
            }
          }
        } else if (task.type === 'revise') {
          if (task.isUnmarking) {
            const hasRevision = revisedVerses.some(rv => rv.verseId === verseId);
            if (hasRevision) {
              useProgressStore.setState((state) => ({
                revisedVerses: state.revisedVerses.filter(rv => rv.verseId !== verseId),
                dailyRevisedVerses: state.dailyRevisedVerses.filter(rv => rv.verseId !== verseId),
                weeklyRevisedVerses: state.weeklyRevisedVerses.filter(rv => rv.verseId !== verseId)
              }));
            }
          } else {
            const hasRevision = revisedVerses.some(rv => rv.verseId === verseId);
            if (!hasRevision) {
              markVerseAsRevised(verseId);
            }
          }
        }
      } catch (error) {
        console.error(`Error processing verse ${verseId}:`, error);
        // Continue with next verse instead of failing the entire task
      }
    }
  }

  // Get verse IDs for a surah
  private getSurahVerseIds(surahId: number): number[] {
    let startVerseId = 0;
    for (let i = 1; i < surahId; i++) {
      const prevSurah = surahsData.find((s: any) => s.id === i);
      if (prevSurah) startVerseId += prevSurah.versesCount;
    }
    
    const surah = surahsData.find((s: any) => s.id === surahId);
    if (!surah) return [];
    
    const verseIds = [];
    for (let i = 1; i <= surah.versesCount; i++) {
      verseIds.push(startVerseId + i);
    }
    
    return verseIds;
  }

  // Check if any task is currently running
  isAnyTaskRunning(): boolean {
    return this.isProcessing;
  }

  // Get current running task
  getCurrentTask(): BackgroundTask | null {
    if (this.currentTaskId) {
      return this.tasks.get(this.currentTaskId) || null;
    }
    return null;
  }
}

export default BackgroundProcessor; 