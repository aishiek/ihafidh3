import { fetchUthmaniTajweedByChapter } from '../services/quranComTajweedService';
import { parseTajweedHTML, TajweedSegment } from '../utils/QuranTajweedParser';

const STRUCTURAL_COMBINING_MARKS = new Set([
  '\u0670', // Arabic Letter Superscript Alef (Dagger Alif / Madd Alif)
  '\u0653', // Maddah Above — must stay with base letter for shaping
  '\u06E5', // Arabic Small Waw
  '\u06E6', // Arabic Small Yeh
  '\u06E0', // Arabic Small High Upright Rectangular Zero (Silent) - Keeps ligature attached
  '\u06DF', // Arabic Small High Rounded Zero (Silent) - Keeps ligature attached
  '\u06DD', // Arabic End of Ayah - Must stay with digits for framing
]);

function isStructuralCombiningMark(char: string): boolean {
  return STRUCTURAL_COMBINING_MARKS.has(char);
}

function splitLeadingIgnorables(text: string): { leading: string; rest: string } {
  let i = 0;
  while (i < text.length && /[\s\u00A0\u200B\u06D6-\u06ED]/.test(text[i])) {
    i++;
  }
  return {
    leading: text.slice(0, i),
    rest: text.slice(i),
  };
}

function startsWithCombiningMarkIgnoringLeading(text: string): boolean {
  const { rest } = splitLeadingIgnorables(text);
  if (!rest) return false;
  const firstChar = Array.from(rest)[0];
  return /^[\u0300-\u036F\u0610-\u061A\u064B-\u065F\u0670\u0653\u06D6-\u06ED\u08D3-\u08FF]/.test(firstChar);
}

function splitOffTrailingCluster(text: string): { head: string; cluster: string } | null {
  if (!text) return null;
  const chars = Array.from(text);
  let i = chars.length - 1;
  while (i >= 0 && /^[\u0300-\u036F\u0610-\u061A\u064B-\u065F\u0670\u0653\u06D6-\u06ED\u08D3-\u08FF]/.test(chars[i])) {
    i--;
  }
  if (i < 0) return null;
  return {
    head: chars.slice(0, i).join(''),
    cluster: chars.slice(i).join(''),
  };
}

function mergeCombiningIntoBase(segments: TajweedSegment[]): TajweedSegment[] {
  const result: TajweedSegment[] = [];

  for (const seg of segments) {
    if (startsWithCombiningMarkIgnoringLeading(seg.text)) {
      if (result.length === 0) continue;

      const prevIndex = result.length - 1;
      const prevInitial = result[prevIndex];
      const { leading, rest } = splitLeadingIgnorables(seg.text);

      if (leading.length > 0) {
        result[prevIndex] = { ...prevInitial, text: prevInitial.text + leading };
      }

      const prev = result[prevIndex];
      const segRest = rest;
      if (!segRest) continue;

      const firstChar = Array.from(segRest)[0];
      if (isStructuralCombiningMark(firstChar)) {
        result[prevIndex] = {
          ...prev,
          text: prev.text + segRest,
        };
        continue;
      }

      const split = splitOffTrailingCluster(prev.text);

      if (split) {
        if (split.head.length === 0) {
          result.pop();
        } else {
          result[prevIndex] = { ...prev, text: split.head };
        }

        result.push({
          ...seg,
          text: split.cluster + segRest,
        });
      } else {
        result[prevIndex] = {
          ...prev,
          text: prev.text + segRest,
        };
      }
    } else {
      result.push({ ...seg });
    }
  }

  return result;
}

function sanitizeRunsForSkia(runs: TajweedSegment[]): TajweedSegment[] {
  if (runs.length === 0) return [];
  const result: TajweedSegment[] = [];

  for (const run of runs) {
    if ((run as any).rule === 'qalqalah_waqf') {
      result.push({ ...run });
      continue;
    }

    if (
      result.length > 0 &&
      run.text &&
      startsWithCombiningMarkIgnoringLeading(run.text)
    ) {
      const prevIndex = result.length - 1;
      const prev = result[prevIndex];
      const { leading, rest } = splitLeadingIgnorables(run.text);

      if (leading.length > 0) {
        result[prevIndex] = { ...prev, text: prev.text + leading };
      }

      const firstChar = rest ? Array.from(rest)[0] : '';
      if (firstChar && isStructuralCombiningMark(firstChar)) {
        const prevAfterLeading = result[prevIndex];
        result[prevIndex] = {
          ...prevAfterLeading,
          text: prevAfterLeading.text + rest,
        };
        continue;
      }

      const split = splitOffTrailingCluster(result[prevIndex].text);

      if (split) {
        if (split.head.length === 0) {
          result.pop();
        } else {
          result[prevIndex] = { ...result[prevIndex], text: split.head };
        }

        result.push({
          ...run,
          text: split.cluster + rest,
        });
      } else {
        const prevAfterLeading = result[prevIndex];
        result[prevIndex] = {
          ...prevAfterLeading,
          text: prevAfterLeading.text + rest,
        };
      }
    } else {
      result.push({ ...run });
    }
  }

  return result;
}

async function run() {
  const data = await fetchUthmaniTajweedByChapter(5);
  const ayah104 = data["5:104"];
  const parsed = parseTajweedHTML(ayah104, { enableAlgorithmic: false, enableStopRules: false });
  console.log("=== 1. parseTajweedHTML (slice around 15..23) ===");
  parsed.slice(15, 23).forEach((s, idx) => console.log(`${idx + 15}: [${s.color}] "${s.text}"`));
  
  const merged = mergeCombiningIntoBase(parsed);
  console.log("\n=== 2. after mergeCombiningIntoBase (slice around 15..23) ===");
  merged.slice(15, 23).forEach((s, idx) => console.log(`${idx + 15}: [${s.color}] "${s.text}"`));
  
  const sanitized = sanitizeRunsForSkia(merged);
  console.log("\n=== 3. after sanitizeRunsForSkia (slice around 15..23) ===");
  sanitized.slice(15, 23).forEach((s, idx) => console.log(`${idx + 15}: [${s.color}] "${s.text}"`));
}
run();
