import { bulkUpdateVerses } from '@/database/QuranDatabase';

export type QueueItem = { verseId: number; state: boolean; type: 'memorized' | 'revised' };

class WriteBackQueue {
  private static queue: QueueItem[] = [];
  private static BATCH_SIZE = 20;
  private static isProcessing = false;

  static enqueue(item: QueueItem) {
    this.queue.push(item);
    this.process();
  }

  private static async process() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.BATCH_SIZE);
      try {
        await bulkUpdateVerses(batch);
      } catch (e) {
        // On failure, requeue and backoff
        this.queue.unshift(...batch);
        await new Promise(res => setTimeout(res, 2000));
      }
      await new Promise(res => setTimeout(res, 500)); // Throttle
    }

    this.isProcessing = false;
  }
}

export default WriteBackQueue; 