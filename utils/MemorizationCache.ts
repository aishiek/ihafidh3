import WriteBackQueue from './WriteBackQueue';

class MemorizationCache {
  private static memorized = new Map<number, boolean>();
  private static revised = new Map<number, boolean>();

  static isMemorized(verseId: number) {
    return this.memorized.get(verseId) ?? false;
  }

  static setMemorized(verseId: number, state: boolean) {
    this.memorized.set(verseId, state);
    WriteBackQueue.enqueue({ verseId, state, type: 'memorized' });
  }

  static isRevised(verseId: number) {
    return this.revised.get(verseId) ?? false;
  }

  static setRevised(verseId: number, state: boolean) {
    this.revised.set(verseId, state);
    WriteBackQueue.enqueue({ verseId, state, type: 'revised' });
  }

  static warmUp(memorizedIds: number[], revisedIds: number[]) {
    memorizedIds.forEach(id => this.memorized.set(id, true));
    revisedIds.forEach(id => this.revised.set(id, true));
  }

  static getAllMemorizedIds(): number[] {
    return Array.from(this.memorized.entries()).filter(([_, v]) => v).map(([id]) => id);
  }

  static getAllRevisedIds(): number[] {
    return Array.from(this.revised.entries()).filter(([_, v]) => v).map(([id]) => id);
  }
}

export default MemorizationCache; 