# Qalqalah Detection Fix - Complete Implementation

## Problem Summary

Qalqalah (red coloring for letters قطبجد at word ends) was **never appearing** in the app despite being implemented in the code. The user identified **3 fundamental issues**:

### Issue 1: Segment Merging Erased Qalqalah
The `mergeSegments()` function combines adjacent segments with the same color. Qalqalah segments were merged into default white color before rendering.

### Issue 2: Condition Never Fired
```typescript
// Original broken code
this.QALQALAH.test(cluster) && cluster.includes(this.SUKOON)
```

**Problem**: In أَحَدٌ, the letter د has **tanween damma (ٌ)**, NOT sukoon (ْ). The condition `cluster.includes(this.SUKOON)` was always false.

### Issue 3: API Segments Skipped Algorithmic Detection
```typescript
// In applyAlgorithmicRules():
if (segment.tajweedClass && API_TAGGED_RULES.has(segment.tajweedClass)) {
  enhanced.push(segment);
  continue; // Skips qalqalah detection entirely
}
```

Segments from Quran.com API bypassed the algorithmic qalqalah detection completely.

---

## Solution: Final Overlay Pass with Segment Splitting

### Key Insight
**Qalqalah cannot be detected inline** because:
- Text doesn't contain sukoon markers at word ends
- Detection must happen AFTER all other processing
- Must split segments to color only the qalqalah letter

### Implementation

#### Step 1: Remove Broken Inline Detection
**File**: `utils/tajweedParser.tsx`

Removed the inline qalqalah detection block that checked for sukoon/shaddah. This was fundamentally flawed and never worked correctly.

#### Step 2: Implement Final Overlay Pass
**File**: `utils/QuranTajweedParser.ts`

```typescript
function applyStopRules(segments: TajweedSegment[]): TajweedSegment[] {
  return segments.flatMap((seg, index) => {
    if (!seg.text) return [seg];
    
    // Match: (prefix)(qalqalah_letter)(diacritical_marks)
    // Example: "أَحَدٌ" → ["أَحَ", "د", "ٌ"]
    const match = seg.text.match(/^(.*?)([قطبجد])([\u064B-\u0652]*)$/);
    
    if (!match) return [seg];
    
    const [, prefix, letter, marks] = match;
    
    // Check if this is at a stop position (word/verse end)
    const isAtStop = isSegmentEnd(index, segments);
    if (!isAtStop) return [seg];
    
    // Split segment: white prefix + red qalqalah
    const result: TajweedSegment[] = [];
    
    if (prefix) {
      result.push({
        text: prefix,
        color: seg.color,
        tajweedClass: seg.tajweedClass,
        source: seg.source,
      });
    }
    
    result.push({
      text: letter + marks,
      color: TAJWEED_COLORS.qalqalah, // #DD0008 (RED)
      tajweedClass: 'qalqalah_waqf',
      source: 'algorithmic',
    });
    
    return result;
  });
}
```

#### Step 3: Wire into TajweedText Component
**File**: `components/TajweedText.tsx`

Added `enableStopRules` prop:
```typescript
interface TajweedTextProps {
  // ... existing props
  enableStopRules?: boolean; // Enable waqf-dependent rules (Qalqalah at stops)
}
```

Updated `parseText` function to accept and pass the option:
```typescript
function parseText(
  text: string, 
  surahNumber?: number, 
  verseNumber?: number,
  enableStopRules: boolean = false
): ColoredSegment[] {
  if (text.includes('<tajweed')) {
    const hybridSegments = parseTajweedHTML(text, {
      enableAlgorithmic: true,
      enableStopRules,  // Pass through
    });
    // ...
  }
}
```

#### Step 4: Update Test Screen
**File**: `app/tajweed-test.tsx`

Pass `enableStopRules` prop to TajweedText:
```tsx
<TajweedText
  text={verse.text_uthmani_tajweed}
  surahNumber={selectedSurah}
  verseNumber={verse.verse_number}
  style={{ fontSize: 28 }}
  enableStopRules={stopRulesEnabled}
/>
```

---

## How It Works

### Three-Pass Pipeline

1. **Pass 1: API Tags** (Quran.com)
   - Ham Wasl, Lam Shamsiyyah, Madd, Silent
   - Always valid during wasl

2. **Pass 2: Algorithmic Wasl-Safe Rules**
   - Ghunnah, Ikhfa, Idgham, Iqlab
   - Valid during continuous recitation

3. **Pass 3: Stop Rules (FINAL OVERLAY)**
   - Qalqalah at word/verse ends
   - Only when `enableStopRules: true`
   - Runs AFTER all other processing
   - Splits segments to isolate qalqalah letter

### Example: Surah Al-Ikhlas 112:1

**Input**: `قُلْ هُوَ ٱللَّهُ أَحَدٌ`

**Without Stop Rules** (Quran.com mode):
```
أَحَدٌ  → [{ text: "أَحَدٌ", color: "#FFFFFF" }]
```

**With Stop Rules** (Mushaf mode):
```
أَحَدٌ  → [
  { text: "أَحَ", color: "#FFFFFF" },
  { text: "دٌ", color: "#DD0008" }  ← RED!
]
```

---

## Testing

### Manual Test
1. Navigate to `/tajweed-test` screen
2. Select **Surah 112 (Al-Ikhlas)**
3. Toggle between modes:
   - **Quran.com Mode**: No red qalqalah
   - **Mushaf Mode**: Red "دٌ" at end of أَحَدٌ

### Expected Results
- Verse 112:1: أَحَدٌ → White "أَحَ" + RED "دٌ"
- Verse 112:2: صَمَدُ → White "صَمَ" + RED "دُ"
- Qalqalah only appears when **enableStopRules: true**

---

## Files Changed

1. ✅ `utils/tajweedParser.tsx` - Removed broken inline qalqalah detection
2. ✅ `utils/QuranTajweedParser.ts` - Implemented correct final overlay pass
3. ✅ `components/TajweedText.tsx` - Added `enableStopRules` prop support
4. ✅ `app/tajweed-test.tsx` - Pass `stopRulesEnabled` to component

---

## Architecture Principles

### Why Final Pass?
- **Waqf Context Required**: Qalqalah only valid at stops
- **Segment Splitting Needed**: Must isolate letter from prefix
- **No Textual Markers**: Tanween looks like marks, not sukoon
- **Post-Processing**: Must run after all other rules applied

### Why Optional?
- **Recitation State Dependent**: During wasl (continuous), no qalqalah
- **User Control**: Toggle between Quran.com (wasl) and Mushaf (waqf) modes
- **Scholarly Correct**: Matches real Mushaf apps and teaching

---

## Debug Tips

If qalqalah still not showing:

1. **Check API Response**: Verify `text_uthmani_tajweed` contains `<tajweed>` tags
2. **Enable Dev Logs**: Check console for "[TajweedText] Using HYBRID parsing"
3. **Verify Regex Match**: Test regex `/^(.*?)([قطبجد])([\u064B-\u0652]*)$/` on segment text
4. **Check Word End Detection**: Verify `isSegmentEnd()` returns true
5. **Inspect Segments**: Use `debugTajweedParsing()` with `enableStopRules: true`

---

## Related Documentation

- [PUSH_NOTIFICATIONS_FIX.md](./PUSH_NOTIFICATIONS_FIX.md) - Previous major fix
- [SCROLL_PRESERVATION_GUIDE.md](./SCROLL_PRESERVATION_GUIDE.md) - Scroll behavior
- [MUSHAF_IMAGE_RESOURCES.md](./MUSHAF_IMAGE_RESOURCES.md) - Mushaf mode resources

---

## Credits

**Root Cause Analysis**: User identified the 3 fundamental issues through deep debugging
**Fix Implementation**: Complete architectural refactor with final overlay pass
**Date**: 2024 (Version 2.0.6)
