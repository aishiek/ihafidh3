# iHafidh — Analytics Parameter Fix + Community Stats Feature
**Spec for Antigravity (AG)**
**Priority: P0 (analytics params) blocks P2 (Community Stats). Do not build Community Stats UI before P0 is verified live in production.**

---

## 0. Why this document exists

This exact fix (surah/juz parameters missing from core events) has been requested across **12+ consecutive analytics review cycles** and has not shipped. This document is the single source of truth — every event, every parameter, every screen, and every acceptance test is listed explicitly so nothing gets partially implemented or skipped again.

**Nothing in this list is optional.** If something can't be done as specified, flag it back before starting — don't ship a partial version.

**Important constraint:** The app has **no login, no username, no email, no user identifier of any kind**. Everything below is fully anonymous — we are only ever counting aggregate totals (e.g. "1,204 people have memorised Al-Baqarah"), never tracking or displaying anything about an individual user. This must remain true throughout. No user ID should ever be written to Firestore in this feature.

---

## 1. P0 — Fix analytics event parameters (do this first, verify in Firebase DebugView before touching Firestore)

### 1.1 `verse_memorization_toggled`
Currently fires with no surah/verse identification. Must become:

```ts
logAnalyticsEvent('verse_memorization_toggled', {
  surah_number: 2,              // int, 1-114, Quran Mushaf numbering
  surah_name: 'Al-Baqarah',     // string, English transliteration, consistent spelling — see 1.7
  juz_number: 1,                // int, 1-30, the juz this verse belongs to
  verse_number: 5,              // int, ayah number within the surah
  is_memorized: true,           // boolean — true = marked memorised, false = un-marked
  source_screen: 'recite',      // string — which screen triggered this
});
```

### 1.2 `verse_revision_toggled`
Same structure as above, revision context:

```ts
logAnalyticsEvent('verse_revision_toggled', {
  surah_number: 2,
  surah_name: 'Al-Baqarah',
  juz_number: 1,
  verse_number: 5,
  is_revised: true,
  source_screen: 'revise',
});
```

**Definition required:** `is_revised: true` must fire on a single, explicitly defined trigger point — decide and document whether this means "user opened this verse in a revision session" or "user marked this verse as successfully revised" (these produce very different counts and different meanings for the community stat). Whichever definition already exists in the current revision flow, state it explicitly here rather than leaving it implicit — this event already exists in the app today, so document current behaviour rather than inventing new behaviour.

### 1.3 `surah_completed`
**Three call sites currently exist in the code — all three must send identical full params.** (One call site currently sends zero params — find and fix it specifically, don't assume all three are already partially correct.)

```ts
logAnalyticsEvent('surah_completed', {
  surah_number: 2,
  surah_name: 'Al-Baqarah',
  verse_count: 286,             // total verses in this surah (static reference data)
  juz_number: 1,                // starting juz of this surah (or primary juz if it spans multiple)
  completion_type: 'memorization', // existing param — keep: 'memorization' | 'verse_by_verse'
  source_screen: 'recite',
});
```

### 1.4 `juz_completed`

```ts
logAnalyticsEvent('juz_completed', {
  juz_number: 1,
  verse_count: 148,             // total verses in this juz (static reference data)
  surah_count: 2,               // number of distinct surahs contained in this juz
  source_screen: 'recite',
});
```

### 1.5 `surah_selected`

```ts
logAnalyticsEvent('surah_selected', {
  surah_number: 2,
  surah_name: 'Al-Baqarah',
  source: 'home',                // 'home' | 'recite' | 'search' | 'planner' | etc — where selection happened
});
```

### 1.6 `favourite_added` / `favourite_removed` / `bookmark_added` / `bookmark_removed`
These currently fire with **no surah/verse context at all** — this must be added, since Community Stats needs "most favourited surah" and "most bookmarked surah":

```ts
logAnalyticsEvent('favourite_added', {   // and favourite_removed, bookmark_added, bookmark_removed — same shape
  surah_number: 2,
  surah_name: 'Al-Baqarah',
  verse_number: 5,
});
```

### 1.7 Reference data — surah names and juz mapping
Use a **single static constant file** (e.g. `constants/quranMeta.ts`) as the one source of truth for:
- `surah_number → surah_name` (114 entries, consistent English transliteration — e.g. always "Al-Baqarah" not sometimes "Al Baqara")
- `surah_number → verse_count`
- `juz_number → verse_count`
- `juz_number → surah_count` and which surahs fall in it
- `surah_number → primary juz_number` (a surah can span multiple juz — use the juz where it starts)

**Every single call site listed above (1.1–1.6) must import from this one file.** Do not hardcode surah names inline at each call site — that's how inconsistent spelling happens and breaks aggregation later.

### 1.8 P0 Acceptance test (do this before writing a single line of Firestore/Cloud Function code)
1. Open Firebase DebugView with a test device
2. Trigger each event in section 1.1–1.6 manually in the app
3. Confirm in DebugView that **every parameter listed above is present and correctly typed** (not stringified numbers, not null, not undefined)
4. Screenshot the DebugView output for each event and share back before proceeding to Firestore work

---

## 2. P2 — Community Stats backend (Firestore + Cloud Functions)

### 2.1 Firestore schema

```
community_stats (single global doc)
  total_surahs_completed: number
  total_juz_completed: number
  total_favourites: number
  total_bookmarks: number
  total_countries: number           // auto-derived, see 2.1a — do not update manually
  updated_at: timestamp

surah_stats/{surahNumber}          // document ID = surah number as string, e.g. "2"
  surah_number: number
  surah_name: string                // denormalized for easy display without a join
  memorized_count: number           // floor-guarded at 0, see 2.2a
  revised_count: number             // floor-guarded at 0, see 2.2a — definition of "revised" in 2.2b
  completed_count: number
  favourite_count: number
  bookmark_count: number
  updated_at: timestamp

juz_stats/{juzNumber}              // document ID = juz number as string, e.g. "1"
  juz_number: number
  completed_count: number
  updated_at: timestamp
```

**Removed from this version:** `total_verses_memorized` / `total_verses_revised` on `community_stats`, and any verse-level (`verse_stats`) collection. Neither has a corresponding UI element in section 3 or a corresponding Cloud Function trigger in section 2.2 — including them would be dead schema. If verse-level inline counts (favourites/bookmarks per individual verse) are wanted in a future phase, that requires a new `verse_stats/{surahNumber}_{verseNumber}` collection and is explicitly out of scope here — see section 3.3 for the current, corrected approach.

### 2.1a `total_countries` — auto-derived, not manual
Do not have a human update this field monthly — that will go stale and get forgotten. Instead, add a scheduled Cloud Function (monthly, e.g. `firebase-functions` pub/sub schedule) that pulls active country count from the Firebase Analytics Data API and writes it to `community_stats.total_countries`. This keeps the field accurate without relying on anyone remembering a manual step. If pulling from the Analytics Data API is not feasible in the timeline, cut this field from the UI entirely rather than shipping a field that silently goes stale.

**Why `juz_stats` as a separate collection:** the requirement is "juz completed count AND which juz" — meaning we need per-juz breakdown (e.g. "Juz 30 has been completed 412 times, Juz 15 only 38 times"), not just a single global juz counter. This lets the Community Stats screen show "Most completed Juz" the same way it shows "Most memorised Surah."

**No user identifiers anywhere in this schema.** These are pure aggregate counters. This is by design and must stay this way.

### 2.2 Cloud Functions — triggers

Each function below is a Firestore-triggered or Analytics-triggered Cloud Function (use whichever integration pattern matches how `mustahabbah_completed`/existing Cloud Functions are already wired in this project — follow the existing pattern, don't introduce a second architecture).

| Trigger event | Firestore writes |
|---|---|
| `verse_memorization_toggled` (is_memorized: true) | `surah_stats/{surah_number}.memorized_count` `+1` via `FieldValue.increment(1)` |
| `verse_memorization_toggled` (is_memorized: false) | `surah_stats/{surah_number}.memorized_count` `-1` via `FieldValue.increment(-1)` |
| `verse_revision_toggled` (is_revised: true/false) | `surah_stats/{surah_number}.revised_count` `±1` |
| `surah_completed` | `surah_stats/{surah_number}.completed_count +1` **and** `community_stats.total_surahs_completed +1` |
| `juz_completed` | `juz_stats/{juz_number}.completed_count +1` **and** `community_stats.total_juz_completed +1` |
| `favourite_added` / `favourite_removed` | `surah_stats/{surah_number}.favourite_count ±1` **and** `community_stats.total_favourites ±1` |
| `bookmark_added` / `bookmark_removed` | `surah_stats/{surah_number}.bookmark_count ±1` **and** `community_stats.total_bookmarks ±1` |

Every write must also update the `updated_at` timestamp on the document being modified.

**Use `FieldValue.increment()` for every counter update — never read-then-write.** At current scale (under 1,000 daily active users) no sharding/distributed counter pattern is needed. Flag it if you disagree based on production write volume, but don't add unnecessary complexity preemptively.

### 2.2a Counter floor — required, this is a real production bug if skipped
`FieldValue.increment(-1)` has no awareness of history. A user who memorised a verse **before this feature shipped** has no corresponding `+1` on record — if they later un-memorise that same verse, the counter goes to **-1**, and can drift further negative over time as this repeats across users. This will happen in practice, not just in theory.

Two acceptable approaches — pick one and document which was used:
- **(a) Floor guard:** in the Cloud Function, read the current value inside a transaction, and only apply the decrement if the resulting value would stay `≥ 0`; otherwise clamp to `0`.
- **(b) Zero-baseline acknowledgment:** explicitly state to the product owner that all counters start at 0 on the release date and pre-existing memorised/favourited/bookmarked content from before that date is not retroactively counted — meaning early "un-toggle" actions on old content are an accepted, understood source of minor undercounting, not something a floor guard needs to solve for.

Do not ship without doing one of these two explicitly — silently allowing negative counters into a screen that says "1,204 people memorised this surah" is a visible, embarrassing bug if it surfaces.

**Idempotency note:** if a Cloud Function can be triggered more than once for the same client-side event (e.g. retry logic, network issues causing duplicate event fires), this must NOT double-count. If the underlying Analytics event trigger doesn't guarantee exactly-once delivery, use a Firestore transaction with an idempotency key, or trigger Cloud Functions from a Firestore write in the client (not directly from Analytics) so Firestore's own consistency guarantees apply. Confirm which pattern is used and document it.

### 2.3 Backend acceptance test
1. From a single test device, memorise 3 verses in Al-Baqarah, complete Al-Fatiha, complete Juz 30, favourite 2 verses, bookmark 1 verse
2. Confirm in Firestore console:
   - `surah_stats/2.memorized_count` = 3
   - `surah_stats/1.completed_count` = 1
   - `juz_stats/30.completed_count` = 1
   - `community_stats.total_surahs_completed` = 1
   - `community_stats.total_juz_completed` = 1
   - `community_stats.total_favourites` = 2
   - `community_stats.total_bookmarks` = 1
3. Un-memorise 1 of the 3 verses, confirm `memorized_count` drops to 2
4. Repeat entire test from a second device to confirm counters aggregate correctly across devices (not per-device state)

---

## 3. P2 — Community Stats screen (client UI)

### 3.1 New screen — "Community" tab or accessible from Home
Show, in this order:

**A. Global counters (top of screen, 4 stat cards)**
- Total verses memorised (community-wide)
- Total surahs completed
- Total juz completed
- Countries represented

**B. Most memorised surahs — top 10 leaderboard**
- Read all 114 docs from `surah_stats`, sort client-side by `memorized_count` descending, take top 10
- Display: rank, surah name (from `surah_name` field, not looked up separately), a proportional bar, and count (e.g. "1.2K")
- **Only show a surah in this list if `memorized_count > 50`** — if fewer than 10 surahs clear this threshold, show fewer than 10 rows. Do not pad with low numbers.

**C. Most completed surahs — top 10** (same pattern as B, sorted by `completed_count`)

**D. Most favourited surahs — top 5** (sorted by `favourite_count`, threshold > 50)

**E. Most bookmarked surahs — top 5** (sorted by `bookmark_count`, threshold > 50)

**F. Juz completed — full breakdown**
- Show all 30 juz with their `completed_count`, sorted by juz number (1→30), not by count — this is a reference list, not a leaderboard
- Highlight (visually, e.g. gold accent) the single juz with the highest `completed_count` as "Most completed Juz"

**G. If `community_stats.total_surahs_completed < 50`:** hide sections B–F entirely and show only the global counters from section A. Numbers under 50 read as empty rather than impressive — don't ship a Community Stats screen with single or double-digit leaderboards.

### 3.2 Inline counts on Surah selection screen
Below each surah name in the surah list:
```
🧠 1.2K memorised
```
- Pull from `surah_stats/{surahNumber}.memorized_count`
- **Only render this line if count > `community_stats_min_threshold`** — omit entirely for surahs below threshold, don't show "🧠 3 memorised"
- Read all 114 `surah_stats` documents once on screen mount and cache in memory for the session — do not issue 114 individual `get()` calls. In Firestore terms this means either (a) reading the whole `surah_stats` collection with a single unfiltered `getDocs(collection(...))` call, since 114 small documents comfortably fits one collection read, or (b) using `getAll()` with an array of 114 doc references if for some reason the collection can't be read unfiltered. Confirm which approach is used — they have different cost/latency characteristics and the spec intent is "one round trip," not "one Firestore query object."

### 3.3 Inline verse-level counts — cut from this phase
Per-verse favourite/bookmark counts (e.g. "♥ 847 🔖 612" beside an individual ayah) are **out of scope for this release.** The Firestore schema in section 2.1 only stores counts at the surah level, not per-verse — building this would require a new `verse_stats/{surahNumber}_{verseNumber}` collection (6,236 potential documents) and a corresponding set of Cloud Function triggers not currently specified. The surah-level inline counts in section 3.2 already deliver the intended social-proof effect at the point where a user is choosing what to memorise next, at a fraction of the complexity. If verse-level counts are wanted later, treat it as a separate follow-up spec.

### 3.4 Client read strategy (cost control)
- Community Stats screen: read `community_stats` (1 doc) + all `surah_stats` (114 docs, single collection read per 3.2) + all `juz_stats` (30 docs, single collection read) = 3 read operations total per screen load
- Cache these reads in memory/state for the app session — refresh only when the user pulls-to-refresh or reopens the screen after backgrounding for >1 hour
- Surah list inline counts: reuse the same `surah_stats` cache if the user navigates from Community Stats to Surah list in the same session — do not re-fetch

### 3.5 Offline / error state — required
The spec must not ship with an undefined loading state. Required behaviour:
- **On Firestore read failure or no network:** show the last successfully cached values with a small "as of [timestamp]" label, if a previous successful read exists this session or from local persistence
- **If no cached values exist at all (first-ever load, no network):** show the global counters section (3.1.A) with a neutral empty state (e.g. "Stats will appear once you're back online") — do not show an infinite spinner
- **Do not block the rest of the app** on this screen's data — Community Stats failing to load must never affect the surah list, recite screen, or any core hifdh functionality elsewhere in the app

---

## 4. Feature flag — required, not optional

The Community Stats UI (section 3) must ship behind a **Firebase Remote Config** flag, not a hardcoded constant. This lets us launch the feature dark, let the backend collect real data silently for several weeks, then turn the UI on remotely with no app release needed.

### 4.1 Remote Config parameters

```
community_stats_enabled: boolean       (default: false)
community_stats_min_threshold: number  (default: 50)
```

### 4.2 Behaviour when `community_stats_enabled = false`
- Community Stats tab/entry point does not render anywhere in the app
- Inline surah counts (section 3.2) do not render on the surah list
- **Backend (section 2) runs regardless of this flag** — Cloud Functions keep incrementing Firestore counters from day one of release, whether or not the UI is visible. This is the entire point: data accumulates silently before launch.

### 4.3 Behaviour when `community_stats_enabled = true`
- All section 3 UI renders as specified
- The `>50` threshold used throughout section 3 must read from `community_stats_min_threshold` remotely, not be hardcoded to `50` in the client — this lets the number be tuned after seeing real data without a new release

### 4.4 Implementation notes
- Use Firebase Remote Config, already available in this project — no new SDK
- Fetch Remote Config on app start with a short cache (e.g. 1 hour) so flag changes propagate quickly, not the default 12-hour Firebase cache
- Flag check should be a single shared hook/utility (e.g. `useCommunityStatsFlag()`) used by every UI surface in section 3 — not re-implemented independently at each screen, so turning it on/off is guaranteed to be consistent everywhere at once

### 4.5 Acceptance test
1. Confirm with flag `false`: build and run the app, verify no Community Stats UI is visible anywhere, but confirm (via Firestore console) that counters are still incrementing when memorisation/completion actions are performed
2. Flip flag to `true` remotely in Firebase console (no rebuild)
3. Confirm within the app's Remote Config refresh interval, the UI appears without requiring an app restart (or document if a restart is required — flag this as a UX consideration if so)

---

## 5. Explicit non-goals — confirm understanding before starting

- **No leaderboard of individual users.** There is no username/email/identifier in this app and none should be introduced for this feature. Every number shown is a global aggregate only.
- **No per-user "your stats vs community" comparison in this phase.** That would require some form of local device-only tracking compared against the community numbers — out of scope for this spec. If you think this is easy to add, flag it separately, don't build it silently.
- **No real-time live feed of "X just completed Y" for this phase**, even though it was discussed conceptually — it requires either exposing granular event timestamps (privacy consideration, even if anonymous, showing "someone in 🇬🇧 just completed X" a few seconds after they did it could theoretically be linkable to a specific session by a sophisticated observer) or a moderation-free public feed. Skip it. Global counters and per-surah/per-juz breakdowns only.

---

## 6. Sequencing — do not reorder

1. **Section 1 (event params)** — ship and verify via DebugView acceptance test (section 1.8) before touching any Firestore code
2. **Section 2 (Firestore + Cloud Functions) + Section 4 (feature flag, defaulted off)** — ship together in one release. This can go live in production collecting real data immediately, with the flag off so no UI shows yet.
3. **Wait until a concrete threshold is met, not a fixed calendar period.** Flip `community_stats_enabled` to `true` when **at least 10 surahs have `memorized_count > community_stats_min_threshold` (default 50)** — this guarantees the top-10 leaderboard (section 3.1.B) actually has 10 rows to show rather than launching with a half-empty list. Check this manually via the Firestore console every 1–2 weeks after the release ships; this is a product owner decision, not a dev task, and realistically will land somewhere in the 4–8 week range depending on adoption — but the trigger is the count, not the calendar.
4. **Section 3 (UI)** — this can actually be *built and shipped in the same release as step 2*, since it's inert behind the flag. It does not need to wait for a separate release cycle — it just needs to wait to be *turned on*.

**Revised recommendation:** ship sections 1–4 together as one release (event params + Firestore/Cloud Functions + UI, all behind the flag). This is simpler than staggering releases — the flag does the staggering for us. Turn the flag on remotely once data looks meaningful.

---

## 7. Final checklist before calling this "done"

- [ ] All 8 events in section 1 verified in DebugView with full correct params
- [ ] `is_revised` trigger point explicitly defined and documented (section 1.2)
- [ ] Single shared `quranMeta.ts` constants file used by all call sites (no inline hardcoded surah names)
- [ ] Firestore schema matches section 2.1 exactly (collection names, field names, types) — no dead fields, no fields without a corresponding trigger
- [ ] Counter floor approach chosen and documented — either transaction-guarded floor at 0, or explicit zero-baseline acknowledgment (section 2.2a)
- [ ] All 7 Cloud Function triggers in section 2.2 implemented and idempotency approach documented
- [ ] `total_countries` auto-derivation scheduled function implemented, or field cut from UI if not feasible (section 2.1a)
- [ ] Backend acceptance test (section 2.3) passed and screenshotted
- [ ] No user identifier of any kind written anywhere in this feature
- [ ] `community_stats_enabled` Remote Config flag implemented, defaulting to `false`, gating all of section 3 UI consistently
- [ ] `community_stats_min_threshold` Remote Config parameter used instead of hardcoded `50` throughout
- [ ] Feature flag acceptance test (section 4.5) passed — backend confirmed running with UI hidden, then UI confirmed appearing on remote flag flip
- [ ] UI sections A–G implemented with correct threshold applied everywhere specified
- [ ] Offline/error/empty state implemented for Community Stats screen (section 3.5) — no infinite spinner, no crash, no blocking of the rest of the app
- [ ] Section 3.3 (verse-level counts) confirmed NOT built — explicitly out of scope this release
- [ ] Collection reads confirmed as single round-trips (not 114 individual document reads anywhere) — approach documented per section 3.2
- [ ] Product owner (not AG) is the one who flips `community_stats_enabled` to `true` in Firebase console, once at least 10 surahs clear the threshold — this should not be flipped automatically by any release

---

# Addendum 2: Missing Global Stats (Badges, Revisions, Quizzes)

This addendum documents the global stats that were identified as missing from the original spec. These cover badges (Hafidh completion), tracking revisions at the Surah and Juz level, and aggregating AI vs. Manual quiz stats.

## 1. Badges & Hafidh Completion

### Analytics Events
*   **Event Name:** `badge_earned`
    *   **Trigger:** When a user completes enough Juz to unlock a badge.
    *   **Parameters:**
        *   `badge_id` (string) - The unique identifier of the badge (e.g., `awwal-noor`, `hafidh-quran`).
        *   `badge_name` (string) - The formatted badge name (e.g., `first_light`, `hafidh_al_quran`).
*   *(Note: The exact badge names and thresholds are defined client-side in `store/badgeStore.ts` and should be referenced directly from there.)*

### Global Stats (community_stats/global)
*   **Field:** `total_hafidh_completions` (Number)
    *   **Trigger:** Incremented locally when a user's `badgeStore` determines they have met the requirements for the `hafidh-quran` badge (30 Juz completed).
    *   **Note:** This is a binary "did they finish" global stat rather than a per-surah metric.

## 2. Revisions (Surah and Juz)

### Surah Revisions
*   **Firestore Schema:** The `surah_stats` collection includes `revised_count`.
*   **Trigger:** Triggered via the Cloud Function listening to the `verse_revision_toggled` analytics event (Section 2.2).
*   **UI Inclusion:** The "Top Surahs" leaderboard now includes a **Revised** tab displaying the surahs with the highest `revised_count`.

### Juz Revisions
*   **Firestore Schema:** The `juz_stats` collection now includes `revised_count`.
*   **Trigger:** Incremented client-side when a user clicks the "Revise Juz" bulk action button on the Juz page, which internally marks all verses in that Juz as revised.
*   **Analytics Event:** `juz_revision_toggled` (with `action: mark_revised` or `unmark_revised`).

## 3. Quizzes (AI vs Manual)

### Analytics Events
*   **Event Name:** `quiz_completed`
    *   **Trigger:** Fired when a user completes any quiz.
    *   **Parameters:**
        *   `quiz_score` (number)
        *   `total_questions` (number)
        *   `quiz_mode` (string) - E.g., `ai`, `manual`.

### Global Stats (community_stats/global)
*   **Fields:**
    *   `total_quizzes_ai` (Number)
    *   `total_quizzes_manual` (Number)
    *   **Trigger:** Incremented client-side when the `addQuizResult` action is dispatched in `progressStore.ts`, passing the quiz mode.

