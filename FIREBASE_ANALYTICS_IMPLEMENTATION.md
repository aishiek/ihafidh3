# Firebase Analytics Implementation - Complete Guide

## Overview
Firebase Analytics has been successfully integrated into the iHafidh React Native app with a focus on **non-blocking event dispatch** and **audio safety**. All analytics events are logged asynchronously using `setImmediate()` to prevent blocking the React Native event loop during critical operations like audio playback.

## Implementation Summary

### ✅ Files Created (1)
1. **`utils/analyticsHelper.ts`** (108 lines)
   - Centralized analytics event dispatcher
   - Safe async dispatch via `setImmediate()`
   - Consolidated `logAudioPlayback()` function for all audio events (verse, surah, page)
   - User property tracking (memorization level, preferences)
   - Screen name mapping utility

### ✅ Files Modified (9)

#### Core Infrastructure
1. **`app/_layout.tsx`** - Global tracking
   - Screen tracking via `usePathname()` on route changes
   - App lifecycle events: `app_open` (once), `app_foregrounded`, `app_backgrounded`
   - User properties initialization with memorization level
   - Integrated into existing AppState listener (no duplication)

2. **`store/progressStore.ts`** - Store-level events
   - `verse_memorization_toggled` - Mark/unmark verses as memorized
   - `memorization_milestone` - Track milestones (1, 10, 50, 100, 250, 500, 1000, 2000, 6236 verses)
   - `bulk_mark_verses` - Bulk marking operations
   - `quiz_completed` - Quiz results with score and percentage

3. **`store/settingsStore.ts`** - User preference tracking
   - `setting_changed` - Font, playback speed, language, reciter changes

#### Feature-Specific Tracking

4. **`components/VerseItem.tsx`** - Verse interactions
   - `audio_playback` - Verse audio with playback speed and repeat settings
   - `verse_memorization_toggled` - Individual verse memorization
   - `verse_revision_toggled` - Individual verse revision
   - `verse_bookmark_toggled` - Bookmark addition/removal
   - `tafsir_opened` - Tafsir modal access

5. **`app/(tabs)/read.tsx`** - Main recitation screen (MOST CRITICAL)
   - `surah_selected` - Surah selection with revelation type
   - `juz_selected` - Juz selection
   - `audio_playback` - Surah audio (consolidated type)
   - `page_mode_activated` - Page mode toggle
   - `page_navigation` - Page scrolling with direction
   - `bulk_mark_verses` + `surah_completed` - Bulk memorization
   - `recite_session_duration` - Session time tracking via cleanup effect

6. **`app/(tabs)/index.tsx`** - Home/Dashboard screen
   - `continue_reading_clicked` - Resume reading action
   - `quick_action_used` - Take Quiz button
   - `ayah_of_day_read` - Ayah of the Day card interaction (in AyahOfTheDayCard.tsx)
   - `mustahabbah_surah_selected` - Recommended surah selection

7. **`components/AyahOfTheDayCard.tsx`** - Daily verse card
   - `ayah_of_day_read` - Tracking when users interact with Ayah of the Day

8. **`app/(tabs)/quiz.tsx`** - Quiz screen
   - `quiz_started` - Random or specific quiz initiated
   - Quiz type, surah, verse count tracking

9. **`app/(tabs)/revision.tsx`** - Revision screen
   - `revision_tab_viewed` - Screen view with goal tracking

10. **`app/(tabs)/stats.tsx`** - Statistics screen
    - `stats_tab_viewed` - Screen view with progress data

11. **`app/(tabs)/badges.tsx`** - Badges screen
    - `badges_screen_viewed` - Badge progress and current tier

## Event Architecture

### Audio Events (Consolidated)
All audio playback uses a single `logAudioPlayback()` event with `audio_type` parameter:
```typescript
logAudioPlayback({
  action: 'play' | 'pause' | 'resume' | 'stop',
  audio_type: 'verse' | 'surah' | 'page',
  surah_id?: number,
  verse_id?: number,
  playback_speed?: string,
  repeat_count?: number,
  infinite_loop?: boolean,
  source?: string
})
```

**Why consolidated?** Reduces event duplication, simplifies Firebase event taxonomy, maintains detailed tracking via parameters.

### Non-Blocking Dispatch Pattern
```typescript
setImmediate(async () => {
  await analytics().logEvent('event_name', { ...params });
})
```

**Why `setImmediate()`?** Ensures Firebase SDK calls don't block React Native event loop during:
- Audio state changes
- High-frequency list scrolling (FlashList)
- Navigation transitions

### User Segmentation
```typescript
setUserProperties({
  memorization_level: 'beginner|novice|intermediate|advanced|expert|hafidh',
  preferred_font: 'arabic_font_name',
  user_type: 'new|returning',
  os: 'ios|android'
})
```

## Event Categories

### 1. Navigation & Screens (8 events)
- `screen_view` - Every route change (automatic via `usePathname()`)
- `continue_reading_clicked`, `surah_selected`, `juz_selected`, `page_mode_activated`, `quick_action_used`
- `revision_tab_viewed`, `stats_tab_viewed`, `badges_screen_viewed`

### 2. Memorization & Progress (6 events)
- `verse_memorization_toggled` - Individual verse marking
- `bulk_mark_verses` - Batch operations
- `surah_completed` - Full surah memorized
- `memorization_milestone` - 1, 10, 50, 100, 250, 500, 1000, 2000, 6236 verses
- `quiz_completed` - Quiz results
- `revision_tab_viewed` - Revision tracking

### 3. Audio Playback (1 consolidated event)
- `audio_playback` - All audio with type, speed, and repeat parameters
- Types: verse, surah, page

### 4. User Actions (5 events)
- `verse_revision_toggled` - Mark revised
- `verse_bookmark_toggled` - Bookmark management
- `tafsir_opened` - Tafsir access
- `ayah_of_day_read` - Daily verses
- `mustahabbah_surah_selected` - Recommended surahs

### 5. Settings & Preferences (1+ events)
- `setting_changed` - Font, speed, language, reciter

### 6. Session Tracking (1+ events)
- `recite_session_duration` - Time spent in read screen
- `app_foregrounded`, `app_backgrounded` - App lifecycle
- `app_open` - App initialization (once per session)

## Data Safety

### ✅ Audio Integrity
- No blocking dispatch → Audio playback unaffected
- Consolidated audio event → Prevents concurrency issues
- All events post-dispatch only → Doesn't interfere with playback start

### ✅ Performance
- Non-blocking async patterns prevent event loop blocking
- FlashList recycling safe via proper dependency arrays
- Store actions remain synchronous (analytics dispatched after)

### ✅ Data Minimization
- Only essential parameters tracked
- No sensitive Quranic content logged
- User privacy preserved with aggregated metrics

## Testing & Validation

### 1. Firebase Debug Mode (Real Device)
```bash
# iOS
RCTBridgeModule -> enable debug mode via Firebase Console

# Android
adb shell setprop debug.firebase.analytics.app com.ihafidh.app
```

### 2. Real-Time DebugView (60s delay expected)
- Open Firebase Console → Analytics → DebugView
- Expected events: `screen_view`, `audio_playback`, `verse_memorization_toggled`, etc.

### 3. Validation Checklist
- [ ] Audio plays without lag (test with surah audio)
- [ ] Quiz completes successfully (events logged without blocking)
- [ ] Revision session duration tracked accurately
- [ ] User properties populated (check Analytics → User Properties)
- [ ] Screen transitions tracked (each route = screen_view event)
- [ ] Events visible in Firebase DebugView within 60 seconds

### 4. Performance Metrics to Monitor
- Time to play audio onset (should be < 50ms)
- FlashList scroll smoothness (list shouldn't jitter)
- Quiz question transition speed
- Memory usage (analytics shouldn't increase baseline)

## Installation & Deployment

### Prerequisites
```bash
npm install @react-native-firebase/analytics@^23.8.3
```

### Environment Setup
1. Firebase project created with Analytics enabled
2. GoogleServices-Info.plist (iOS) and google-services.json (Android) configured
3. Firebase initialization in app/_layout.tsx ✅

### Deployment Steps
1. ✅ Firebase Analytics SDK installed
2. ✅ All event handlers integrated
3. ✅ TypeScript compilation passes (no analytics errors)
4. Build and test on physical device with DebugView
5. Monitor events in Firebase Console for 24-48 hours post-launch

## Key Design Decisions

1. **Consolidated Audio Events**: Reduces event explosion while maintaining detail through parameters
2. **Non-Blocking Dispatch**: Critical for audio safety - ensures analytics never blocks playback
3. **Store Integration**: Analytics dispatch post-state-update, not during update
4. **Screen Tracking via Router**: Automatic via `usePathname()`, no manual tracking needed
5. **AppState Listener Reuse**: Merged with existing listener, avoids duplicate lifecycle events
6. **No Store Signature Changes**: All analytics are side effects, don't modify public APIs

## Troubleshooting

### Events Not Appearing in DebugView
- [ ] Device in DebugView mode? (`adb shell setprop ...`)
- [ ] Wait 60+ seconds (delayed sync)
- [ ] Check Firebase project ID in GoogleServices config
- [ ] Verify `@react-native-firebase/analytics` module loaded

### Audio Playback Lag
- [ ] Check `setImmediate()` is wrapping all `logEvent()` calls
- [ ] Profile with Hermes/V8 debugger (audio should start in < 50ms)
- [ ] Verify read.tsx playback speed variable is scoped correctly

### High Memory Usage
- [ ] Ensure event queue is processing (check logs for `[Analytics]` messages)
- [ ] Verify cleanup effects are running (session duration tracking)
- [ ] Check for circular event references in complex features

## Future Enhancements

1. **Custom Event Properties**: Add more granular tracking (e.g., quiz difficulty level)
2. **Session Duration Tracking**: Extend to other screens beyond read.tsx
3. **Feature Usage Funnels**: Track progression through onboarding/feature discovery
4. **Crash Reporting**: Integrate Firebase Crashlytics
5. **Remote Config**: A/B test analytics-driven features

## References
- [Firebase Analytics for React Native](https://rnfirebase.io/analytics/usage)
- [Event Naming Best Practices](https://firebase.google.com/docs/analytics/best-practices)
- [React Native Performance Tips](https://reactnative.dev/docs/performance)

---

**Implementation Date**: 2025-01-24  
**Status**: ✅ Complete, Ready for Testing  
**Module Status**: @react-native-firebase/analytics@^23.8.3 installed  
**TypeScript Status**: All analytics code compiles without errors
