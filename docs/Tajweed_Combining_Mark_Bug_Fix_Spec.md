# Tajweed Rendering Bug — Combining Mark Orphaning
**Spec for Antigravity (AG)**
**Priority: P0 — visible rendering corruption (letters displaying as wrong glyphs) and silent tajweed color loss on madda-tagged text.**

---

## 0. Summary

Some words with a `madda_*` tajweed tag are rendering with corrupted glyphs (a base letter shape rendering as an entirely different letter shape, e.g. in ٥:١٠٤) and/or losing their orange madda coloring. Root cause has been traced to `parseAPITags()` in `utils/QuranTajweedParser.ts`: the Quran.com API wraps only the bare alif in `<tajweed class="madda_*">`, not the `\u0653` (MADDAH ABOVE) mark that follows it. This creates a segment that **starts with an orphaned combining mark**, which then triggers a destructive code path in `TajweedText.tsx`'s `mergeCombiningIntoBase()` — it deletes the previous (correctly-colored) segment and reassigns styling from the orphan's segment instead. This corrupts both the run boundaries feeding into `sanitizeRunsForSkia()`'s ZWJ-injection logic (→ glyph corruption) and the color (→ lost madda highlighting).

Confirmed reproducible on Surah 5, Ayah 104 (compare `ءَابَآءَنَآ`, which breaks, vs `ءَابَآؤُهُمْ` in the same ayah, which renders correctly — same character class, different tag-boundary luck).

**Do the fixes in the order below. Do not skip ahead to step 6 unless step 4's assertion still fires after steps 1–3 are done.**

---

## 1. Fix the root cause — reattach orphaned marks in `QuranTajweedParser.ts`

Add this function, and call it immediately after `parseAPITags()`, before anything else touches the segments:

```ts
const ORPHAN_COMBINING_MARK = /[\u0300-\u036F\u0610-\u061A\u064B-\u065F\u0670\u0653\u06D6-\u06ED\u08D3-\u08FF]/;

/**
 * Reattach any combining mark that landed at the start of a segment (an artifact
 * of the API's <tajweed> tag boundaries not including trailing diacritics) onto
 * the END of the previous segment, preserving the previous segment's color/class.
 * This must run before algorithmic detection and before TajweedText's merge logic
 * ever sees the segments — it's the single point where these orphans are created.
 */
function reattachOrphanCombiningMarks(segments: TajweedSegment[]): TajweedSegment[] {
  const result: TajweedSegment[] = [];

  for (const seg of segments) {
    if (!seg.text) { result.push(seg); continue; }

    const chars = Array.from(seg.text);
    let i = 0;
    while (i < chars.length && ORPHAN_COMBINING_MARK.test(chars[i]) && result.length > 0) {
      const prev = result[result.length - 1];
      result[result.length - 1] = { ...prev, text: prev.text + chars[i] };
      i++;
    }

    const remainder = chars.slice(i).join('');
    if (i === 0) {
      result.push(seg);
    } else if (remainder) {
      result.push({ ...seg, text: remainder });
    }
    // if remainder is empty, the whole segment was marks and got fully absorbed — drop it
  }

  return result;
}
```

Wire it into the main pipeline:

```ts
export function parseTajweedHTML(
  html: string,
  options: TajweedOptions = {}
): TajweedSegment[] {
  const {
    enableAlgorithmic = true,
    enableStopRules = false,
  } = options;

  if (!html) return [{ text: '', color: '#FFFFFF', tajweedClass: null, source: 'api' }];

  let segments = parseAPITags(html);
  segments = reattachOrphanCombiningMarks(segments);   // ← NEW: fix orphans at the source

  if (enableAlgorithmic) {
    segments = applyAlgorithmicRules(segments);
  }

  return segments;
}
```

---

## 2. Defense-in-depth — add `\u0653` to `STRUCTURAL_COMBINING_MARKS` in `TajweedText.tsx`

This protects two *other* rendering paths that never go through `QuranTajweedParser.ts` at all: STRATEGY 2 (inline `[markup]` text) and STRATEGY 3 (pure algorithmic fallback) inside `TajweedText.tsx`. Fix #1 alone does not cover those.

```ts
const STRUCTURAL_COMBINING_MARKS = new Set([
  '\u0670', // Dagger Alif
  '\u0653', // Maddah Above — same fusion requirement as Dagger Alif.
            // The API only tags the bare base letter for madda rules, so this
            // mark routinely arrives as its own segment — it needs the same
            // full-merge treatment as \u0670, not the harakah pull-forward path.
  '\u06E5', // Arabic Small Waw
  '\u06E6', // Arabic Small Yeh
  '\u06E0', // Arabic Small High Upright Rectangular Zero (Silent)
  '\u06DF', // Arabic Small High Rounded Zero (Silent)
  '\u06DD', // Arabic End of Ayah
]);
```

---

## 3. Defense-in-depth — handle `\u0653` in `TajweedParser.parse()` (`utils/tajweedParser.tsx`)

Used directly by STRATEGY 3. Currently only `\u0670` (MADD_ALIF) gets special merge-into-previous-segment handling. Extend the same branch to also catch `\u0653`:

```ts
// 2. Check for Madd (elongation indicator)
else if (char === this.MADD_ALIF || char === '\u0653') {
  if (segments.length > 0) {
    const prevSeg = segments[segments.length - 1];
    prevSeg.text += char;
    if (prevSeg.text.match(/[اوي\u0670]/)) {
      prevSeg.color = TAJWEED_COLORS.madd;
      prevSeg.rule = 'madd';
    }
  } else {
    segments.push({ text: char, color: TAJWEED_COLORS.default });
  }
  i++;
  continue;
}
```

---

## 4. Add a permanent assertion — not just a manual dev log

Two parts:

**(a) Dev-time runtime check**, right after `reattachOrphanCombiningMarks` runs in `parseTajweedHTML`:

```ts
if (__DEV__) {
  segments.forEach(s => {
    if (s.text && ORPHAN_COMBINING_MARK.test(Array.from(s.text)[0])) {
      console.warn('[TajweedParser] orphan mark survived reattachment:', JSON.stringify(s));
    }
  });
}
```

**(b) A permanent unit test** (not just a one-time manual check) that feeds a handful of known API-tagged strings — including ones with a `<tajweed class="madda_*">` boundary immediately followed by an untagged `\u0653` — through `parseTajweedHTML()` and asserts no output segment's text starts with a combining mark. This bug class will regress silently the next time someone touches `parseAPITags()` or its regex, so this needs to be a test that runs in CI, not tribal knowledge.

---

## 5. Retest — 5:104 first, then broaden

1. Re-render Surah 5, Ayah 104. Confirm `ءَابَآءَنَآ` now renders with correct glyph shapes and correct orange madda coloring, matching `ءَابَآؤُهُمْ` in the same ayah.
2. Confirm the dev assertion from step 4(a) does **not** fire for this ayah.
3. **This is not a one-ayah bug.** The mismatch between where the API closes `<tajweed>` tags and where Unicode combining marks actually attach is structural and will recur anywhere a madda-tagged alif is immediately followed by an untagged `\u0653` — this is common across the mushaf, not rare. Spot-check at least 3–4 other madda-heavy ayahs for both correct glyph shape *and* correct madda color before calling this closed (color loss was a silent symptom of the same bug and easy to miss if you only eyeball glyph shapes).

---

## 6. Only if step 5 still fails after steps 1–3

Do not start here — only proceed to this step if the dev assertion in step 4(a) is clean (no orphan marks reach the render pipeline) but the glyph is still visually wrong. That would mean the data model is clean and the remaining bug is downstream, in `sanitizeRunsForSkia()`'s ZWJ-injection logic or the Skia `ParagraphBuilder` text-run construction in `TajweedText.tsx`. Flag back before making changes there — that code has several interacting passes and needs its own targeted look rather than a quick patch.

---

## 7. Checklist before calling this done

- [ ] `reattachOrphanCombiningMarks()` added and wired into `parseTajweedHTML()`
- [ ] `\u0653` added to `STRUCTURAL_COMBINING_MARKS` in `TajweedText.tsx`
- [ ] `\u0653` handled alongside `\u0670` in `TajweedParser.parse()`
- [ ] Dev-time console.warn assertion added for orphan marks
- [ ] Permanent unit test added (not just manual/dev check) covering tag-boundary-adjacent `\u0653` cases
- [ ] 5:104 retested — glyph shape AND color both confirmed correct
- [ ] 3–4 additional madda-heavy ayat spot-checked for glyph shape AND color
- [ ] If still broken after all of the above: investigated `sanitizeRunsForSkia`/`ParagraphBuilder` separately, not bundled into this same fix
