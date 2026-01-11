import GraphemeSplitter from 'grapheme-splitter';

const splitter = new GraphemeSplitter();

/**
 * Drop-in string adapter that works in grapheme clusters
 * instead of JS UTF-16 code units.
 * 
 * Handles complex Arabic text with diacritics, ensuring that:
 * - Characters + diacritics stay together (e.g., "نْ" = 1 grapheme)
 * - Indexing refers to visual units, not code points
 * - Slicing never breaks mid-character
 * 
 * Example:
 * ```ts
 * const text = new GraphemeString("نْ");
 * text.length // 1, not 2
 * text.charAt(0) // "نْ", not "ن"
 * ```
 */
export class GraphemeString {
  private readonly graphemes: string[];
  private readonly source: string;

  constructor(text: string) {
    this.source = text;
    this.graphemes = splitter.splitGraphemes(text);
  }

  /** Original string */
  toString(): string {
    return this.source;
  }

  /** Grapheme-safe length */
  get length(): number {
    return this.graphemes.length;
  }

  /** text[i] replacement */
  charAt(index: number): string {
    return this.graphemes[index] ?? '';
  }

  /** text.slice(start, end) replacement */
  slice(start?: number, end?: number): string {
    return this.graphemes
      .slice(start ?? 0, end ?? this.length)
      .join('');
  }

  /** substring compatibility */
  substring(start: number, end?: number): string {
    const s = Math.min(start, end ?? this.length);
    const e = Math.max(start, end ?? this.length);
    return this.slice(s, e);
  }

  /** Iterate like a string */
  [Symbol.iterator]() {
    return this.graphemes[Symbol.iterator]();
  }

  /** Access raw grapheme array if needed */
  getClusters(): readonly string[] {
    return this.graphemes;
  }

  /**
   * Check if a specific grapheme cluster matches a regex
   * Safer than testing on broken code units
   */
  test(index: number, regex: RegExp): boolean {
    const cluster = this.graphemes[index];
    return cluster ? regex.test(cluster) : false;
  }

  /**
   * Find the index of a grapheme cluster that matches a regex
   * Returns -1 if not found
   */
  findIndex(regex: RegExp, startIndex: number = 0): number {
    for (let i = startIndex; i < this.graphemes.length; i++) {
      if (regex.test(this.graphemes[i])) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Get a range of graphemes around an index
   * Useful for looking back/ahead in Tajweed parsing
   */
  getRange(index: number, before: number, after: number): string[] {
    const start = Math.max(0, index - before);
    const end = Math.min(this.graphemes.length, index + after + 1);
    return this.graphemes.slice(start, end);
  }
}
