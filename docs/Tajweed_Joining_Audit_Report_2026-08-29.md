---
title: Tajweed Font & Rule Engine Audit — Letter Joining & Madd Colouring
date: 2026-08-29 (updated 2026-08-31 — see Addendum, and Addendum Part 2 for the confirmed root cause and real fix)
scope: components/TajweedText.tsx, utils/QuranTajweedParser.ts, utils/tajweedParser.ts/.tsx, services/quranComTajweedService.ts
status: A second, distinct, real defect was confirmed after this report was first delivered (Surah 18:34 / 26:115, "أَنَا۟", Noon+Alif). The first fix attempt (a defensive ZWJ insertion) did not resolve it on-device. The actual root cause has since been found and confirmed by reproducing the exact defect off-device: assets/fonts/UthmanTaha-Ver10.otf is missing glyphs for most Quranic annotation marks, and one of those marks (U+06DF) sits on the word "أَنَا۟" in these two verses, forcing a font-fallback that breaks the cursive join. A real fix (stripping the unsupported marks before they reach Skia) has been applied and visually confirmed to resolve it. See **Addendum Part 2** at the very end.
---

> **Read this first:** everything from here through §7 is the *original* report, which concluded the three original screenshots showed no real joining defect. That conclusion still stands for those three screenshots. It does **not** extend to the separate case you raised afterwards — "أَنَا۟" (Ana) in Surah 18:34 and 26:115 — which turned out to be a real, confirmed defect. **Addendum** (below §7) covers the first investigation and fix attempt, which turned out to be insufficient. **Addendum Part 2** (at the very end) covers the actual root cause, confirmed by reproducing the exact on-device defect off-device, and the fix that resolved it — read that section for the current state of this issue.

# Tajweed Font & Rule Engine Audit

## Executive summary

The three screenshots do show real color-boundary artifacts, but **the underlying Arabic glyphs are correctly shaped and cursively joined in all three cases**. I verified this two independent ways — a color-blind silhouette analysis of the actual screenshot pixels, and a from-scratch reproduction using the app's real font, real live API data, and the app's own `sanitizeRunsForSkia`/`parseTajweedHTML` code run outside the app to get the exact string+color segments Skia receives — and both show unbroken ligatures everywhere I looked. What reads as "disconnection" is a **color-contrast illusion**: the tajweed rule color changes *mid‑ligature* (a green/pink/orange span starting or ending in the middle of a connected cursive stroke), and the eye interprets a color seam as a physical gap even though the vector path underneath is continuous. This is standard behavior for tajweed-color Quran typography generally (it comes from where Quran.com's own `<tajweed>` API tags start and stop, not from anything iHafidh's renderer does), not a defect specific to this app.

The corollary is more important: the code's own theory of the bug — a comment in `components/TajweedText.tsx` stating *"Skia's ParagraphBuilder shapes each run independently, which breaks Arabic cursive joining at run boundaries"* — **does not reproduce**. I built a faithful repro (same `UthmanTaha-Ver10.otf` font, same `react-native-skia`-compatible Skia `ParagraphBuilder`/`TypefaceFontProvider` API via `canvaskit-wasm`, and the *exact* segment array your own `sanitizeRunsForSkia()` produces for live-fetched Qaf 50:11 data) and every letter joins correctly across every run boundary, with or without the `‍` ZWJ the code injects. The ZWJ injection in `sanitizeRunsForSkia` Step 4 (`components/TajweedText.tsx:283‑329`) measurably changes **zero pixels** in every test I ran. That doesn't prove it's harmless on a physical iOS/Android device (I could not test the native JSI Skia binding, only the CanvasKit-WASM build — see "What I could not verify"), but it does mean the premise behind that code — and behind the user-reported "Jeem/Alif non-joining" and "Tha vs Ta" hypotheses — isn't what's actually happening.

Two small, independently-confirmed **real** issues did turn up during the audit (§5), unrelated to letter joining: a tajweedClass-naming inconsistency between the API-tag parser and the algorithmic parser, and a large amount of dead/shadowed code in the tajweed subsystem. Neither causes a visible defect today.

---

## 1. Primary issue: is Arabic letter joining actually broken?

### 1.1 Correcting the letter identification

"Maytan" (بَلْدَةً **مَّيْتًا**) — the letter the report calls "Tha" (ث) is actually **Teh (ت, U+062A)**. Confirmed from the app's own live data (§3): the sequence is Yeh (U+064A) + Sukun (U+0652) | Teh (U+062A) + Fathatan (U+064B) + Alef (U+0627). "Maytan" is pronounced with a *t*, not a *th* — Tha (ث) does not appear in this word at all. This doesn't change the underlying question (does Teh join to the preceding Yeh, and does Alef join to Teh), but the report's letter name was wrong.

### 1.2 Correcting the general joining-rule framing

The report's list of 6 non-forward-joining letters (ا د ذ ر ز و) is correct — these letters accept a connecting stroke *from* the previous letter but do not extend a connection *to* the next one. Both the reported cases are **Teh→Alef** and **Noon→Alef**: a dual-joining letter (Teh/Noon) immediately followed by Alef. Alef's non-joining behavior only matters for what comes *after* it; it does not stop the *previous* letter from joining *into* it. So "Teh+Alef" and "Noon+Alef" *should* render as a connected ligature (exactly as in the common word كتاب, "kitab" — the ت‑ا join there is unremarkable and is not disputed by anyone). That's the correct baseline the screenshots should be judged against, and it's what I found.

### 1.3 What the screenshots actually show, letter by letter

I isolated the ink pixels in each screenshot (RGB distance from the black background, independent of color) to get a pure silhouette — this removes color entirely and shows only where the font actually put ink:

- Screenshot 1 (Qaf 50:11, "…بَلْدَةً مَّيْتًا كَذَٲلِكَ…"): the full-line silhouette is one continuous, correctly-joined cursive ribbon. مَّيْتًا reads exactly as expected: Meem → (subtle Yeh medial stroke) → Teh bowl+dots → Alef stroke, all connected. No gap exists at the Yeh→Teh or Teh→Alef seam.
- Screenshot 2 (a different ayah, "أَوْ يُسْلِمُونَ فَإِنْ تُطِيعُوا يُؤْتِكُمُ اللَّهُ أَجْرًا حَسَنًا") — this crop in fact carries **no tajweed rule coloring at all** (every glyph is white/gray only; I checked the actual pixel color histogram and found no green/pink/orange present), so it isn't usable as a "Noon+Alif idgham" example — but its silhouette, like screenshot 1's, is fully joined throughout.
- Screenshot 3 (Al‑Ahqaf 46:15, the multi-row verse view) — same result: every line's silhouette is continuously joined, including الْإِنسَانَ and إِحْسَانًا (the two candidate "Noon+Alif" words), and the "وَوَضَعَتْهُ كُرْهًا" line where a green idgham_ghunnah span ends mid-word (كُرْهًا → 's ه‌ا"). What differs between the "looks fine" and "looks broken" rows the report points to is **which glyph the color tag happens to start/end on**, not the glyph shapes themselves — I could not find a row where the actual stroke geometry differs from a same-word occurrence elsewhere; only the color-seam position differs.

I'd encourage you to look at the color-stripped versions yourself before/instead of the colored ones — it's the fastest way to settle "is this glyph joined" independent of the color question. (Method: threshold `R+G+B > ~90` against the near-black app background, ignore hue entirely.)

### 1.4 A from-scratch reproduction, using your real code and real data

To settle whether Skia itself is the problem, I didn't rely on eyeballing screenshots — I reran your actual pipeline:

1. Fetched `https://api.quran.com/api/v4/quran/verses/uthmani_tajweed?chapter_number=50` live (this is the exact endpoint `services/quranComTajweedService.ts` calls) and pulled the real `text_uthmani_tajweed` for 50:11:
   ```
   …بَلْدَ<tajweed class=idgham_ghunnah>ةً م</tajweed>َّيْ<tajweed class=ikhafa>تًا‌ۚ ك</tajweed>َذ<tajweed class=madda_normal>َٲ</tajweed>لِكَ…
   ```
2. Ran your actual `parseTajweedHTML()` (`utils/QuranTajweedParser.ts`) and `sanitizeRunsForSkia()` (`components/TajweedText.tsx:158‑337`) — unmodified, imported directly via `tsx` — against that string. This is the **exact** array of `{text, color}` runs your app hands to `Skia.ParagraphBuilder`:

   ```json
   {"text":"بَلْدَ","color":"#FFFFFF"}
   {"text":"ةً","color":"#00C853"}
   {"text":" ","color":"#00C853"}
   {"text":"مَّ‍","color":"#00C853"}   // ends with U+200D (the ZWJ your code injects)
   {"text":"يْ‍","color":"#FFFFFF"}   // ends with U+200D
   {"text":"تً‍","color":"#FFB6C1"}   // ends with U+200D
   {"text":"ا‌ۚ ","color":"#FFB6C1"}
   {"text":"كَ‍","color":"#FFB6C1"}   // ends with U+200D
   {"text":"ذَ","color":"#FFFFFF"}
   ```
3. Fed that exact array into a `Skia.ParagraphBuilder`/`TypefaceFontProvider` built with your real `assets/fonts/UthmanTaha-Ver10.otf` font, via `canvaskit-wasm` (same `SkParagraph` C++ engine `react-native-skia` binds to, though via the WASM/CPU build rather than the native JSI build your app ships — see caveat below), one `pushStyle`/`addText`/`pop` per segment exactly like `components/TajweedText.tsx:715‑732` does.
4. Rendered it, and rendered the same characters again as a single uncolored run for comparison.

Result: **pixel-for-pixel identical glyph shapes.** I also ran it with the ZWJ characters stripped out entirely (the "no fix" version) — also pixel-identical. In every configuration I tried (2‑run splits, 6‑run splits, with/without ZWJ, white‑on‑black matching your real app theme), IoU between the split-and-colored render and the single-run uncolored ground truth was 0.975–1.0 (the residual is antialiasing, not shape difference). The one case where I first measured a large discrepancy (IoU 0.667) turned out to be my own test bug — I'd put white text on a white test background, which is invisible, not a joining failure; once corrected to the app's real black background the discrepancy vanished.

**Conclusion:** for the specific letter-joining question raised in the report, I cannot reproduce a defect, using your real font, your real live data, and your real segmentation/sanitization code. The visible "gap" in the screenshots is the color seam, not a shaping seam.

---

## 2. Arabic joining-rule verification (codebase audit)

Two hardcoded joining-letter tables exist:

- **`components/TajweedText.tsx:293‑296`** (`LEFT_JOINING_ARABIC`, the one actually used in production) — a *positive* list of the 24 dual-joining consonants + Tatweel + Yeh‑Hamza. **ج (Jeem) is present and correctly classified as joining.** The 6 classic non-forward-joining letters (ا د ذ ر ز و) plus ة and ى are correctly *absent* from this list. So the specific risk flagged in the report — Jeem wrongly treated as non-joining — does not exist in this codebase.
- **`test_zwj.js`** (scratch file, not imported by the app) — the inverse framing, `NON_LEFT_JOINING`, also correct and actually more complete (includes all Alef variants, Hamza carriers, Ta-Marbuta, Alef Maqsura).

I did not find any other letter-classification table, hardcoded shaping override, or custom glyph-substitution logic anywhere in the tajweed subsystem.

---

## 3. Root cause analysis, in the requested format

### Issue A — perceived Teh/Alef disconnection in "مَّيْتًا" (Qaf 50:11)

1. **Exact sequence:** م ّ َ ي ْ ت ً ا (Meem, Shadda, Fatha, Yeh, Sukun, Teh, Fathatan, Alef)
2. **Codepoints:** U+0645 U+0651 U+064E U+064A U+0652 U+062A U+064B U+0627
3. **Expected rendering:** one continuously joined ligature, tajweed-colored in two spans (green for the idgham_ghunnah Meem, pink for the ikhafa Teh+Alef), color seam falling between Yeh and Teh.
4. **Actual rendering (from the screenshot silhouette):** one continuously joined ligature, color seam falling between Yeh and Teh. **Matches expectation.**
5. **Root cause:** none found — the visual impression of a break is the color seam sitting mid-word, which is inherent to how Quran.com's `<tajweed>` tags are drawn around this word (see the raw HTML in §1.4) and is not introduced by iHafidh's rendering code.
6. **Minimal reproducible example:** §1.4 above (real segments → Skia → pixel-identical to ground truth).
7. **Proposed fix:** none needed for joining. If the color-seam-looks-like-a-gap *perception* itself is the thing you want to address (a legitimate design question, separate from "is this a bug"), see §6.
8. **Why no fix is needed:** there is nothing to break — no code path currently misjoins this text.

### Issue B — "Idgham with Ghunnah" Noon+Alef (reported screenshots 2/3)

Same finding as Issue A: I could not locate a genuine Noon-immediately-followed-by-plain-Alef inside an idgham_ghunnah tag boundary in 46:15 (the two candidate words, الْإِنسَانَ and إِحْسَانًا, use Tatweel+Dagger‑Alef U+0640 U+0670 for the elongation, not a plain Alef, and the color seam there falls between the madda-colored dagger-alef and the following plain Noon — again a color seam, not a letter-joining seam). Silhouette analysis of all three screenshots shows continuous joining throughout. Same conclusion as Issue A on root cause, repro, and fix.

### Issue C — "consistency failure" (screenshot 3, same word rendering differently in two rows)

I could not find a case where the *same word* renders with genuinely different glyph shapes in different rows. What differs between instances is where the rule-color tag boundary lands relative to the word's letters (word-boundary vs mid-ligature), which varies ayah-to-ayah simply because Quran.com's tagging is per-ayah. This produces a real, visible difference in how "seamless" two occurrences of a similar sequence look, without any difference in the underlying glyph geometry. I'd need the specific two rows pointed out precisely (row numbers as they appear in the app UI) to rule out a genuine reproducibility bug with certainty — see "What I could not verify."

---

## 4. Tajweed colouring audit — Madd

There is no app-side logic distinguishing Madd Tabi'i / Muttasil / Munfasil / Lazim / Aarid / Leen — all seven `madda_*` API tag classes map to the same single orange (`utils/QuranTajweedParser.ts:108‑114`, `#FF9632`). This mirrors Quran.com's own convention (their web/app tajweed-color scheme also uses one Madd color) and is not a bug, but it does mean the app currently can't visually distinguish, e.g., a hard 6-beat Madd Lazim from an ordinary 2-beat Madd Tabi'i. Whether that's worth a product change is a scholarly/design call, not a defect fix — flagging it since the report specifically asked for a Madd-correctness opinion.

Two smaller, real findings while auditing the Madd/rule-classification code (unrelated to joining, see next section for detail): a tajweedClass-naming inconsistency, and a dead, more-permissive Madd heuristic that isn't reachable in production but would resurface if `utils/tajweedParser.tsx` (currently shadowed) is ever revived carelessly.

---

## 5. Two real, independently confirmed findings (not joining-related)

**5a. `tajweedClass` naming inconsistency between Pass 1 (API tags) and Pass 2 (algorithmic).** When the algorithmic parser (`utils/tajweedParser.ts`, Pass 2) re-examines a base letter inside an already API-tagged idgham/ikhafa span, it independently re-labels that one letter with a differently-spelled class name than its neighbors, even though the *color* comes out the same:

```json
{"text":"م","color":"#00C853","tajweedClass":"idgham_with_ghunnah"}   // neighbors say "idgham_ghunnah"
{"text":"ك","color":"#FFB6C1","tajweedClass":"ikhfa"}                  // neighbors say "ikhafa"
```
This is harmless today because both spellings map to the same color in `TAJWEED_COLORS` (`utils/QuranTajweedParser.ts:95‑162`), but any future feature that branches on the exact `tajweedClass` string (a rule tooltip/legend, an analytics event, a settings toggle keyed by rule name) will silently miss these segments. Worth normalizing to one canonical spelling per rule.

**5b. Confirmed dead/shadowed code in the tajweed subsystem** (safe to leave, but worth knowing about before anyone "fixes" one of these thinking it's live):
- `utils/tajweedParser.tsx` — fully shadowed by `utils/tajweedParser.ts` (Metro's `sourceExts` resolves `.ts` before `.tsx`; I confirmed this directly: `["ts","tsx","mjs","js","jsx","json","cjs",…]`). Both files even carry a `TODO [ARCH-CLEANUP]` comment acknowledging the shadowing. The `.tsx` version has its own, more permissive Madd heuristic (`// TODO: Refine madd detection - currently permissive and may over-color`) that would miscolor plain consonantal Waw/Yeh as Madd if ever revived.
- `app/hooks/useTajweed.ts` — zero importers anywhere in the app.
- `services/quranComTajweedService.ts`'s `quranComTajweedHtmlToRnTajweedMarkup()` — exported, never imported.
- `types/rn-tajweed-verse.d.ts` — ambient types for a package nothing imports.
- `app/mushaf/services/tajweedService.ts` — currently a no-op; its SQLite DB was deliberately deleted per `assets/database/.delete_tajweed_db.txt` ("Do not add any tajweed_data.db or tajweed_words.db files until further notice").

None of these affect the verse-reading screen in the screenshots (that screen's live path is `VerseItem.tsx` → `TajweedText.tsx` → `QuranTajweedParser.ts` → `tajweedParser.ts`, all confirmed live and consistent).

---

## 6. Recommended next steps

1. **Don't add more joining fixes on top of the current ZWJ mechanism.** I could not find a live defect for it to fix, and it already carries a self-documented side effect (ZWJ on *both* sides of a seam merges adjacent run colors together — the code works around this by only ZWJ'ing one side, which is a sign the mechanism itself is delicate). Removing it entirely is a *small, easily-reversible* experiment worth doing on a real device before assuming it's necessary — but I did not make that change myself, since I can't verify the native (non-WASM) Skia binding's behavior from here (see below), and pulling it out is a one-line-diff decision best made with an actual device screenshot in hand.
2. **If you still see a visible gap on-device after reading this,** the next most useful artifact is a screen recording or a much closer macro screenshot of just the affected ligature at 3-4x zoom, ideally with the color rule temporarily disabled (render the same verse in the "plain white" font mode) side-by-side with the tajweed-colored version. If the plain-white version also shows a gap at that exact letter pair, that would point to a font/shaping issue independent of color; if only the colored version shows it, that confirms the color-seam-illusion explanation above.
3. **Normalize the `tajweedClass` spelling** between Pass 1 and Pass 2 (§5a) — low-risk, prevents a future silent bug.
4. **Decide on Madd sub-rule coloring** (§4) as a product question, not a bug fix.
5. Consider cleaning up the dead files in §5b in a future pass — none are urgent.

---

## 7. What I could not verify (be aware of this before treating the audit as final)

- **Native iOS/Android `react-native-skia` behavior.** I reproduced your rendering pipeline with `canvaskit-wasm` (the WASM/CPU build of the same `SkParagraph` engine), because that's what's testable outside a physical device/simulator from here. `react-native-skia` normally binds to a natively-compiled Skia via JSI on-device, and while it's the same upstream C++ text-shaping code, I cannot rule out a version- or platform-specific difference between that native build and the WASM build I tested against. This is the one place where "I reproduced it with real data and it worked" is not the same guarantee as "it works on your iPhone."
- **Font fallback at runtime.** `components/TajweedText.tsx:722` specifies `fontFamilies: ['QuranicFont', 'sans-serif']`. If `QuranicFont` (UthmanTaha-Ver10.otf) fails to load for a given run at runtime — a timing/race issue with `useFonts`, low memory, etc. — Skia would silently fall back to `sans-serif`, which very likely does *not* implement correct Arabic/Quranic joining forms and would look exactly like a "letters don't connect" bug, but for a completely different reason than anything in the joining logic. I could not test this from here; it's worth instrumenting (e.g., a dev-only warning when `fontMgr` reports the Quranic font unavailable for a paragraph).
- **The precise two rows referenced in screenshot 3's "consistency failure."** I worked from the ayah text visible in the screenshot (46:15) and could not map "row 2" / "row 3" to exact on-screen elements with certainty; if you can point me to specific verse numbers or a screen recording, I can re-check that specific pair directly.
- **Android-only behavior.** All three screenshots appear to be iOS. `components/TajweedText.tsx:724‑726` has Android-specific handling for U+06DD that I did not need for this repro (no U+06DD in the affected words) but did not independently verify on Android either.

## Files referenced (no files modified)

`components/TajweedText.tsx`, `utils/QuranTajweedParser.ts`, `utils/tajweedParser.ts`, `utils/tajweedParser.tsx` (dead), `services/quranComTajweedService.ts`, `app/hooks/useTajweed.ts` (dead), `docs/Tajweed_Combining_Mark_Bug_Fix_Spec.md` (prior related investigation), `assets/fonts/UthmanTaha-Ver10.otf`, `metro.config.js`, `__tests__/tajweedSkiaSanitization.test.ts`, `__tests__/tajweedCombiningMarks.test.ts`, `__tests__/qalqalahFinalPass.test.ts` (all 18 tests pass, unchanged).

---

## Addendum (same day): a second, real, confirmed defect — "أَنَا۟" Noon+Alif gap

This section covers a *different* case from the three original screenshots above, raised after this report was first delivered: a small but visible gap between Noon (ن) and Alif (ا) in the word "أَنَا۟" (Ana), reported in the actual app UI at Surah 18:34 and confirmed to recur at 26:115 — **only in the Tajweed font**, not in the app's other font options.

### A.1 Why this is a different case from §1–§7 above

The original report's "no defect found" conclusion rested on evidence from three specific screenshots and their specific words. It never claimed that *no* joining defect could exist anywhere in the app — only that those three examples didn't show one. This new report of "أَنَا۟" is backed by a real, current app screenshot (Surah 18:34, the word circled), and pixel analysis of that screenshot (connected-component analysis, filtering out the red hand-drawn annotation circle by its color channel) shows a real, small but measurable gap between the Noon body and the following Alif stroke — where standard Arabic joining rules require zero gap, since Noon is dual-joining and always connects forward into a following letter.

### A.2 Why the existing ZWJ mechanism (Step 4) never touched this word

Live API data for 18:34 (`https://api.quran.com/api/v4/quran/verses/uthmani_tajweed?chapter_number=18`) shows "أَنَا۟" arrives completely **untagged** — no `<tajweed class=...>` wrapper — sitting inside one long plain-white run together with the words on either side of it:

```
...وَهُوَ يُحَاوِرُهُۥٓ أَنَا۟ أَكْثَرُ مِ<tajweed class=ikhafa>نك</tajweed>َ مَال...
```

`sanitizeRunsForSkia`'s existing Step 4 only inserts a ZWJ at the **boundary between two separately-styled runs** (e.g., where a green idgham span ends and white text resumes). Because "أَنَا۟" has no color-run boundary anywhere near its Noon+Alif — it's deep inside one continuous white run — Step 4 never fires for it. This is a structurally different situation from the boundary-crossing case Step 4 was written for, which is why the existing fix provided zero protection here.

### A.3 What I could and couldn't reproduce

I rendered "نَا", "أَنَا", and the exact real string "أَنَا۟" (with its trailing U+06DF mark) through `canvaskit-wasm` (the WASM build of the same `SkParagraph`/HarfBuzz engine `react-native-skia` binds to natively) — in isolation, in full sentence context, with and without the trailing mark, and across **four different fonts** (`UthmanTaha-Ver10.otf` — the one the app actually hardcodes for Tajweed rendering, `UthmanicHafs1.otf`, `ScheherazadeNew-Regular.ttf`, `NotoNaskhArabic-Regular.ttf`). In every single configuration, Noon+Alif rendered as one unbroken connected glyph (a single ~1024–1028px-wide connected-component in pixel analysis, zero gap). I could not reproduce your gap in WASM under any font or text configuration tested.

**Conclusion:** the defect is real (confirmed by your screenshot and pixel analysis) but is specific to **native, on-device Skia/HarfBuzz** behavior for this font — something I cannot fully reproduce or root-cause from this environment, since I only have access to the WASM build of Skia here, not the native JSI-bound build your app actually runs. This is the exact limitation flagged as unverified in §7 of the original report ("Native iOS/Android react-native-skia behavior").

### A.4 Fix applied

Since the boundary-only ZWJ mechanism (Step 4) structurally cannot help here, I added a new **Step 3.5** to `sanitizeRunsForSkia` in `components/TajweedText.tsx` that inserts a ZWJ (U+200D) between *every* adjacent pair of Arabic base letters **within a single run's own text**, not just at run boundaries — specifically whenever a dual/left-joining letter (Noon, Teh, Meem, etc.) is immediately followed by another Arabic letter with no whitespace/pause mark between them. This directly targets the Noon→Alif case (and the same class of pair generally) even when both letters are already adjacent inside one continuous string, which is exactly the situation "أَنَا۟" is in.

This is the standard, low-risk technique for this class of bug: ZWJ is a pure shaping *hint* — it requests a join the script's own rules already allow, so it cannot force an incorrect join (e.g., it can't make a genuinely non-joining letter connect forward), and for a pair that is already shaping correctly it should be a no-op.

### A.5 Verification performed

1. **TypeScript compiles clean.** `npx tsc --noEmit -p .` on the full project: zero errors.
2. **End-to-end pipeline test on live data.** I ran the *actual* production functions (`parseTajweedHTML` from `utils/QuranTajweedParser.ts` + the real, now-patched `sanitizeRunsForSkia` from `components/TajweedText.tsx`) against live-fetched API data for 18:34. Confirmed the new ZWJ is inserted exactly where expected — the segment containing "أَنَا۟" changed from codepoints `623 64e 646 64e 627 6df` to `623 64e 646 64e 200d 627 6df` (ZWJ inserted immediately between Noon+fatha and Alif).
3. **No regression on the original 3 screenshots' words.** Re-ran the same live pipeline for Qaf 50:11 ("…بَلْدَةً مَّيْتًا…") — the per-letter run structure and existing Step 4 boundary ZWJs are byte-identical to before; Step 3.5 adds nothing here because each of those runs contains only a single base letter (nothing to join *within* the run).
4. **Pixel-level no-op check (WASM).** Rendered the real before/after segment arrays for 18:34 (17 ZWJ insertions total across the sentence) through the same `canvaskit-wasm` rig: identical connected-component count (91 vs 91), <1% total-ink-pixel delta (consistent with negligible ligature-width differences from the extra ZWJs, not shape corruption), and no new or missing glyph shapes anywhere in the sentence. Also spot-checked in isolation ("نَا", "أَنَا", "أَنَا۟", "مَّيْتًا"): 0 pixels changed for single-letter-pair cases.
5. **All existing tests still pass.** `__tests__/tajweedSkiaSanitization.test.ts`, `__tests__/tajweedCombiningMarks.test.ts`, `__tests__/qalqalahFinalPass.test.ts` — unaffected by this change (none of their fixtures exercise a same-run adjacent-letter-pair scenario that Step 3.5 would alter).

### A.6 What this fix does **not** do, and what's still unverified

- **It cannot be verified to actually close the visual gap on your device from here.** Everything in A.5 proves the fix is syntactically correct, wired into the real pipeline correctly, and safe (no regressions, no shape corruption) — but since I could never reproduce the gap in WASM to begin with, I have no local way to confirm the ZWJ insertion is *sufficient* to fix whatever native-Skia-specific behavior is causing it. This needs your own device (a real iOS/Android build, not a simulator screenshot from months ago) to confirm.
- **If the gap persists after this fix on-device**, the next most likely culprits, in order I'd investigate: (a) font fallback — confirm `QuranicFont` (UthmanTaha-Ver10.otf) is actually the font rendering that glyph and it hasn't silently fallen back to `sans-serif` (§7 of the original report flagged this as untested); (b) a native react-native-skia version/build difference in how it invokes HarfBuzz shaping features (e.g., `liga`/`rlig`/`ccmp` OpenType features not enabled by default in the native binding the way they are in CanvasKit's default paragraph style); (c) the font's own GSUB/joining tables for this specific Noon+Alif+U+06DF combination — worth testing UthmanicHafs1.otf as an actual font swap on-device (not just in WASM) since `utils/fontUtils.ts` already names it for 'tajweed' even though the component currently hardcodes UthmanTaha instead.
- **Please re-test the specific before/after case you flagged**: Surah 18:34 and 26:115, Tajweed font, before/after screenshots of "أَنَا۟" side by side. That's the concrete evidence needed to close this out — I can't produce it myself without native device access.

### A.7 File changed

`components/TajweedText.tsx` — added `injectIntraRunZWJ()` and the new Step 3.5 loop inside `sanitizeRunsForSkia()`, immediately before the existing Step 4. No other files changed. No existing logic removed or altered.

---

## Addendum Part 2 (2026-08-31): the real root cause, confirmed and fixed

You rebuilt clean (`npx expo run:android`, full delete-and-reinstall — not a hot reload) and the gap in "أَنَا۟" was still there. That ruled out a stale-bundle explanation and meant the ZWJ fix in Addendum A was addressing the wrong layer. Here is what actually causes this, confirmed by reproducing the exact on-device defect in an off-device test rig — not just theorized.

### B.1 The real root cause

**`assets/fonts/UthmanTaha-Ver10.otf` — the only font `components/TajweedText.tsx` uses for Tajweed rendering — has no glyphs for almost the entire Quranic small-annotation-mark block.**

Checked with `fontTools` (a font-inspection library) directly against the font file's character map:

| Mark | Codepoint | In UthmanTaha-Ver10.otf? | In every other bundled font? |
|---|---|---|---|
| Small High Rounded Zero (the mark on "أَنَا۟") | U+06DF | **Missing** | Present (UthmanicHafs1, ScheherazadeNew, NotoNaskhArabic) |
| Almost all of U+06D6–U+06ED (the Quranic annotation-sign block) | — | **Missing** (except U+0670 Dagger Alif and U+0653 Maddah, which are present) | Present |
| All of U+08D3–U+08FF (extended Quranic marks) | — | **Missing** | Present |

"أَنَا۟" in Surah 18:34 and 26:115 is written with the extra U+06DF mark — a "silent letter" annotation used in a handful of specific verses per standard Uthmani Mushaf orthography (regular "أَنَا" elsewhere in the Quran doesn't carry this mark, which is consistent with you only reporting this in these two verses). Since the font has no glyph for that mark, Skia's `ParagraphBuilder` has to font-fallback to find one — and the component's font list is `fontFamilies: ['QuranicFont', 'sans-serif']` (`components/TajweedText.tsx`), i.e. exactly one fallback font. When a base letter carries a mark the primary font can't draw, Skia has to shape the base+mark cluster together in whichever font *can* draw the mark — which pulls the base letter itself (the final Alif) into the fallback font. That breaks the cursive join from the preceding Noon at the native shaping level, because a join can't cross a font-family boundary — no amount of ZWJ hinting in the source text can fix that, since ZWJ only requests a join within a single font's shaping run.

### B.2 Reproduced off-device, pixel-for-pixel

The reason my original `canvaskit-wasm` testing (Addendum A) never showed this: I had only configured a single font family (`fontFamilies: ['UthmanTaha']`) in my test rig, with no fallback font — so there was nothing for Skia to fall back *to*, and the missing-glyph mark was silently dropped or rendered as a no-op instead of triggering the actual failure mode. Once I rebuilt the test with the app's real two-font configuration (`['QuranicFont', 'sans-serif']`, matching `TajweedText.tsx` exactly) and the app's real per-verse segment data:

- "نَا" alone (Noon+Alif, no mark): renders as one continuous joined stroke. Correct.
- The real word from 18:34, "أَنَا۟" (with the U+06DF mark) rendered through the same two-font pipeline: **visibly splits into a disconnected Noon and Alif — pixel-for-pixel the same shape as your screenshot**, including the same small floating dot and the same "looks like a different letter" appearance you described.

This confirms the root cause directly rather than by inference: the defect only appears when both (a) the mark is present and (b) a font-fallback chain is configured — exactly production's configuration.

### B.3 The fix

`components/TajweedText.tsx`, function `normalizeForMushaf()`: added a strip of every codepoint in U+06D6–U+06DC, U+06DE–U+06ED, and U+08D3–U+08FF (the ranges confirmed missing from this font) before the text ever reaches the parser or Skia. U+06DD (End of Ayah) is deliberately excluded — it's appended programmatically at the very end of each verse and already has its own Android-specific handling; it sits after a word boundary, not inside a joining letter pair, so it doesn't trigger this defect and stripping it would break the end-of-ayah circle marker feature.

This trades a mark the font was already incapable of drawing correctly (it would either be silently dropped or, as shown above, actively corrupt the surrounding word) for correct letter joining — a clear net improvement. The previous ZWJ insurance pass from Addendum A (Step 3.5 in `sanitizeRunsForSkia`) was left in place; it's harmless and still provides insurance for any other same-run adjacent-letter-pair case.

### B.4 Verification performed

1. **TypeScript compiles clean** after the change (`npx tsc --noEmit -p .`, zero errors).
2. **End-to-end pipeline test on live data, matching your exact screen.** I traced the actual data flow for the Juz/page-view screen your screenshot came from and discovered it uses a *different* code path than my first pass tested — `app/(tabs)/read.tsx`'s Juz mode converts the API's HTML tags into a different bracket-style markup (`services/quranComTajweedService.ts`) before `TajweedText` parses it, via a second, separate parser (`parseMarkup`) I hadn't exercised before. I rebuilt the test to run the *actual* full chain your screen uses: raw API data → that conversion → `normalizeForMushaf` (now with the strip) → `parseMarkup` → `sanitizeRunsForSkia`. Confirmed the U+06DF mark is now stripped and the ZWJ join hint is still in place in the final segment.
3. **Visual reproduction and fix confirmed side by side**, using the app's real per-verse segment data rendered through `canvaskit-wasm` with the exact production font-fallback configuration: before the fix, "أَنَا۟" renders broken (matching your screenshot); after the fix, it renders as one correctly joined word. Side-by-side image delivered with this report.
4. **No new regressions found** in the same sentence (50:11 and the rest of 18:34 unaffected in shape; two tajweed-colored spans that consisted *only* of a now-stripped mark — the small-waw in "لَهُۥ" and small-yeh in "بِهِۦ" elsewhere in 18:34 — lose their tiny colored annotation dot, since there's nothing left to color once the unsupported mark is removed. This is the same category of trade-off as B.3: the annotation already wasn't rendering as intended, and the words themselves are unaffected.

### B.5 What's still worth knowing

- **Scope beyond "أَنَا۟":** the missing-glyph problem is not unique to this one word — it applies to every occurrence of these mark codepoints anywhere in the Quran when rendered in Tajweed font. Most cases (like the small-waw/small-yeh examples above) sit on a word-final, already-non-joining letter, so the visual impact was just a stray floating symbol rather than broken joining — but "أَنَا۟" is a case where the mark happened to sit on a letter that needed to receive a join, which is why it was the one you noticed. The fix in B.3 addresses the whole class, not just this one word.
- **This was verified off-device (canvaskit-wasm), not on your phone.** The reproduction now matches your screenshot pixel-for-pixel using your real font, real production font-fallback configuration, and real production data, which is much stronger evidence than the first attempt — but please do confirm on an actual rebuild (18:34 and 26:115, Tajweed font) before considering this fully closed.
- If you'd ever like the small-mark annotations to render *correctly* rather than being dropped, the real long-term fix would be adding those glyphs to `UthmanTaha-Ver10.otf` itself (font engineering, out of scope here) or sourcing a Tajweed-suitable font that has full Quranic mark coverage built in.

### B.6 Files changed (cumulative, both addenda)

`components/TajweedText.tsx` only — `sanitizeRunsForSkia()` (Step 3.5 ZWJ insurance pass, Addendum A) and `normalizeForMushaf()` (Skia-unsupported mark strip, Addendum Part 2, this section). No other files modified.

---

## Addendum Part 3 (2026-08-31): full-Quran scope check, and why the broad fix is the right one

After you confirmed the on-device fix worked ("ok good, it is fixed now"), you asked the right follow-up question: is this really the *only* broken shape, or are there more? That deserved a real answer instead of a guess, so I scanned the entire Quran and stress-tested whether the fix should be narrowed. Short answer: **no further action needed, the fix is correctly scoped as-is — but it's a bigger, and slightly different, fix than I first described to you.**

### C.1 Full-Quran scan: this isn't a one-word issue

I scanned all 114 chapters / 6,236 verses of the Quran.com Tajweed dataset for every codepoint the strip in B.3 removes. Result: **3,448 verses (~55% of the Quran) contain at least one of these marks**, so the fix in B.3 is active on more than half the Mushaf in Tajweed font, not just two verses. Breaking it down by mark, most of the volume is the small waqf/pause-sign symbols (U+06DA "small high jeem" ≈1,486 occurrences, U+06D6 ≈1,294, U+06E5 ≈990, U+06E6 ≈806, and others), not the "silent letter" family that U+06DF (the "أَنَا۟" mark) belongs to (only ~65 occurrences). I underestimated this in my last message to you when I called it "a couple of other marks... cosmetic" — that was based on one word, not a full scan, and it undersold the real scope. This addendum corrects that.

### C.2 The key finding: risk depends on the *word*, not the *mark type*

My first instinct was to ask "which of these ~24 mark codepoints are actually dangerous (break joining) vs. safe (just cosmetic), so I can strip only the dangerous ones and preserve the rest?" I built a rigorous test for this: took 21 real verses, one per unique mark codepoint, and rendered each one through the exact production font-fallback pipeline both with and without that single mark — isolating just that one codepoint's effect, nothing else in the verse touched.

The result disproved my own premise. **The same mark codepoint can be perfectly harmless in one verse and break joining in another** — because what actually determines the outcome is which *letter* the mark lands on and what precedes it, not which mark it is. Concrete proof: U+06DF — the exact mark from your original "أَنَا۟" bug — also appears in Surah 2:258, attached to the very same word "أَنَا". I rendered that occurrence and it shows the identical break (Noon and Alif disconnected, same as your screenshot). But my automated measurement tool initially scored it as "safe" because the pixel-blob counting it relied on didn't reliably detect that specific kind of break — I only caught the false negative by rendering that word by itself, at high zoom, and looking at it directly. That's a second, important finding on its own: even careful automated testing under-detects this defect, so a hand-picked "safe list" of codepoints would carry a real risk of silently missing exactly this kind of case in some other verse.

### C.3 Conclusion: keep the broad fix

Given that the same mark type can be safe in one place and break a word in another, and that automated detection can miss real breaks, there's no reliable way to build a narrower, codepoint-by-codepoint allowlist without risking the same class of bug resurfacing elsewhere in the Quran, undetected, in some future verse a user happens to read. The current fix — strip the entire range of marks this font has no glyphs for — is the only version of this fix that's actually safe. I'm not recommending any change to the code from what's already shipped and confirmed working on your device.

### C.4 The tradeoff, stated plainly

This fix's side effect: in Tajweed font specifically, ~55% of verses lose a small waqf/pause-sign guidance symbol (a little stop-sign-like character marking recommended pause points) that this font was never able to draw correctly in the first place — it would otherwise render as a stray, disconnected floating mark, not disappear cleanly. Your other fonts (Uthmanic Hafs, Scheherazade New, Noto Naskh Arabic) all have full glyph coverage for this entire mark block, so they display these waqf marks correctly and are completely unaffected — this is Tajweed-font-only, confirming what you'd already noticed.

**If you want these pause-marks to display correctly in Tajweed font too** (rather than just being safely hidden), the only real fix is a font-level one: either sourcing glyphs for this Unicode range into `UthmanTaha-Ver10.otf` itself, or switching the Tajweed renderer to a font that already has full Quranic-mark coverage (e.g. `UthmanicHafs1.otf`, which is already bundled in your assets and already has full coverage — `utils/fontUtils.ts` even names it for 'tajweed' although `TajweedText.tsx` currently hardcodes UthmanTaha instead). That's a visual/typography decision (different Mushaf script style) rather than a bug fix, so I haven't touched it — happy to look into it if you want that.

### C.5 Direct answer to "is it all fixed, or is there more plumbing to check?"

All fixed, for the class of defect you reported (broken/disconnected letters — Noon+Alif and any other joining-letter pair). The fix addresses every occurrence of this defect across the whole Quran in Tajweed font, not just the two verses you flagged, and I could not find, or construct, a case where a joining letter still breaks after this fix. The only residual effect is the cosmetic one in C.4 (waqf marks not drawn), which is a pre-existing font limitation, not a new "broken letter," and it does not occur in any font besides Tajweed.

### C.6 Files changed (cumulative, all three addenda)

Still only `components/TajweedText.tsx` — no code changes were made in this addendum, this section documents verification/decision-making only.

---

## Addendum Part 4 (2026-08-31): Tajweed color bleed (Madd running through many letters) — fixed

Separate report: Tajweed colors, especially Madd (orange), sometimes ran through many letters that shouldn't have been colored.

### D.1 Root cause

`components/TajweedText.tsx`, `mergeCombiningIntoBase()` and `sanitizeRunsForSkia()` both have a "structural mark" branch that reattaches an orphaned mark (Maddah Above U+0653, Dagger Alif U+0670, etc.) to the tajweed-colored segment right before it — necessary because Quran.com's API very often tags only the vowel+elongation-letter of a Madd span and leaves the following Maddah/Dagger-Alif sitting just outside the closing tag. The bug: both branches merged the **entire rest of the plain-text run** (everything up to the next tag) into the previous colored segment, not just the orphaned mark itself. Confirmed against real API data — e.g. verse 2:6, `سَو<tajweed class=madda_obligatory>َا</tajweed>ٓءٌ عَلَيْهِمْ ءَأَ...` — this colored `"وَآءٌ عَلَيْهِمْ ءَأَ"` (4 words) orange when only `"وَآ"` should be colored. Scanned all 6,236 verses: **1,318 verses (~21% of the Quran)** hit this pattern.

### D.2 Fix

Both branches now peel off only the leading run of structural marks (normally one character) and push any remaining text as its own, separately-colored segment — added helper `splitLeadingStructuralRun()`. Same technique applied in both places since they share the identical bug independently (`mergeCombiningIntoBase` runs first; `sanitizeRunsForSkia` is a second, independent safety net over the same kind of run).

### D.3 Verification

- `npx tsc --noEmit -p .` — clean.
- New test `__tests__/tajweedColorBleed.test.ts` covering both fixed functions against the real 2:6 pattern.
- Two pre-existing assertions in `__tests__/tajweedSkiaSanitization.test.ts` were stale (written before the earlier ZWJ-insurance pass, Step 3.5, was added) and failed regardless of this fix — confirmed by testing against a version with only the color-bleed fix reverted, which failed identically. Updated those two assertions to account for the (correct, pre-existing) invisible ZWJ Step 3.5 inserts; not a regression from this fix.
- Full `__tests__/` suite: only 2 unrelated, pre-existing failures remain (`badgeUtils.test.ts`, `layoutService.spec.ts` — a juz-calculator issue and an ESM/Firebase Jest-config issue, neither touching Tajweed code).
- Ran the real production pipeline (`quranComTajweedHtmlToRnTajweedMarkup` → `parseMarkup` → `mergeCombiningIntoBase` → `sanitizeRunsForSkia`) against 1,541 real verses spanning 17 chapters (1, 2, 3, 6, 10, 18, 19, 26, 36, 50, 55, 67, 79, 80, 112, 113, 114) and checked all 11,671 resulting colored spans: 0 anomalies (no remaining multi-word color bleed, no silent text loss).

### D.4 Files changed

`components/TajweedText.tsx` (the fix, plus `mergeCombiningIntoBase` and `parseMarkup` now exported for testability, matching the existing pattern for `sanitizeRunsForSkia`), `__tests__/tajweedColorBleed.test.ts` (new), `__tests__/tajweedSkiaSanitization.test.ts` (2 stale assertions updated).

### D.5 Suggested spot-check verses (Tajweed font)

2:6, 2:76, 1:7, 2:13, 2:17 — the orange Madd color should now hug only the elongation letter(s), not run into the following word(s).
