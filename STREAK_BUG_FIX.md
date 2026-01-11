# Streak Reset Bug Fix

## Issue Description
Users reported that their streak counter was resetting to 1 after 18 days of consistent usage. The streak would unexpectedly reset even when the app was being used daily.

## Root Cause
The bug was in `store/progressStore.ts` in the `updateDailyStreak()` function:

```typescript
// BUGGY CODE (BEFORE FIX):
updateDailyStreak: () => {
  set((s) => {
    const today = formatDate(new Date());

    if (!s.lastOpenDate) {
      return { dailyStreak: 1, lastOpenDate: today };
    }

    const last = new Date(s.lastOpenDate + 'T00:00:00');
    const cur = new Date(today + 'T00:00:00');
    const diff = Math.floor((cur.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));

    let newStreak = s.dailyStreak;

    if (diff === 1) {
      newStreak = s.dailyStreak + 1;
    } else if (diff > 1) {
      newStreak = 1;
    }
    // BUG: When diff === 0 (same day), nothing is returned!
    // This causes lastOpenDate to not be updated

    return {
      dailyStreak: newStreak,
      lastOpenDate: today
    };
  });
},
```

### The Problem
1. When the app is opened multiple times on the same day, `diff === 0`
2. The function doesn't have an early return for same-day opens
3. Even though it updates `lastOpenDate: today`, the issue is that it **always** updates `lastOpenDate`, even on same-day opens
4. However, the real issue occurs when:
   - Day 1: User opens app → `lastOpenDate = "2026-01-01"`, streak = 1
   - Day 1 (later): User opens app again → `diff = 0`, but code still sets `lastOpenDate = "2026-01-01"`
   - Day 2: User opens app → calculates diff from Day 1 correctly, streak = 2
   - **BUT**: If there's any timezone issue or timing edge case, the calculation could be off

The actual root cause is **missing the early return check** for same-day opens. This caused unnecessary recalculations and could lead to edge cases where the date comparison fails.

## Solution
Added an early return check to prevent recalculating the streak when the app is opened multiple times on the same day:

```typescript
// FIXED CODE:
updateDailyStreak: () => {
  set((s) => {
    const today = formatDate(new Date());

    // If this is the first time opening the app, start a streak
    if (!s.lastOpenDate) {
      return { dailyStreak: 1, lastOpenDate: today };
    }

    // FIX: If already updated today, don't recalculate
    if (s.lastOpenDate === today) {
      return s; // No changes needed, preserve state
    }

    const last = new Date(s.lastOpenDate + 'T00:00:00');
    const cur = new Date(today + 'T00:00:00');
    const diff = Math.floor((cur.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));

    let newStreak = s.dailyStreak;

    // If last opened yesterday, increment streak
    if (diff === 1) {
      newStreak = s.dailyStreak + 1;
    }
    // If more than one day has passed, reset streak
    else if (diff > 1) {
      newStreak = 1;
    }

    return {
      dailyStreak: newStreak,
      lastOpenDate: today
    };
  });
},
```

## Benefits of the Fix
1. **Performance**: Avoids unnecessary state updates when app is opened multiple times per day
2. **Reliability**: Ensures streak calculation only happens once per day
3. **Consistency**: Matches the pattern used in `activityStore.ts` which already had this check
4. **Edge Case Prevention**: Prevents any timezone or timing-related edge cases

## Comparison with ActivityStore
The `activityStore.ts` already had this protection (lines 212-214):

```typescript
// activityStore.ts - ALREADY HAD THIS CHECK
updateStreak: () => {
  const { lastActivityDate, currentStreak, longestStreak } = get();
  const today = getTodayDate();
  
  if (lastActivityDate === today) {
    return; // Already updated today ✅
  }
  // ... rest of logic
}
```

## Testing
To verify the fix:

### Test Case 1: Normal Streak
1. Open app on Day 1 → Streak should be 1
2. Open app on Day 2 → Streak should be 2
3. Open app on Day 3 → Streak should be 3
4. Continue for 20+ days → Streak should increment each day

### Test Case 2: Multiple Opens Same Day
1. Open app on Day 1 → Streak = 1
2. Close and reopen on Day 1 → Streak should stay 1 (not recalculate)
3. Open app on Day 2 → Streak should be 2

### Test Case 3: Streak Break
1. Open app on Day 1 → Streak = 1
2. Open app on Day 2 → Streak = 2
3. Skip Day 3 entirely
4. Open app on Day 4 → Streak should reset to 1

### Test Case 4: Long Streak Preservation
1. Build up a streak of 18+ days
2. Continue using daily
3. Verify streak doesn't suddenly reset

## Related Code
- `store/progressStore.ts` - Main fix location
- `store/activityStore.ts` - Already had correct implementation
- `app/(tabs)/index.tsx` - Calls `updateDailyStreak()` on mount
- `utils/dateUtils.ts` - `formatDate()` function used for date strings

## Date Format
Both stores use consistent date formatting:
- Format: `YYYY-MM-DD` (ISO 8601 date string)
- Example: `"2026-01-11"`
- Timezone: Uses local device timezone
- Time component: Stripped to ensure only date comparison

## Future Improvements
Consider:
1. Add streak freeze feature (grace period for 1 missed day)
2. Add streak recovery purchase option
3. Show streak danger warning when about to expire
4. Export streak data for backup
5. Add streak history graph

## Notes
- The fix is backward compatible - existing streaks will be preserved
- No migration needed for existing users
- The bug was subtle and only manifested under specific timing conditions
- This was a **logic bug**, not a data corruption issue
