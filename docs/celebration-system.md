# Celebration System - Usage Guide

## Overview
Reusable confetti celebration component for different achievements in the app.

**Architecture Decision**: We use a custom-built confetti system instead of `react-native-confetti-cannon` because:
- ✅ Zero external dependencies (lighter bundle)
- ✅ Full control over animations and timing
- ✅ 100% Expo compatible (no native build needed)
- ✅ Already integrated with app settings (Arabic fonts, sizing)
- ✅ Uses `useNativeDriver: true` for optimal performance
- ✅ Type-safe with TypeScript
- ✅ Customizable per celebration type

## Components

### `CelebrationModal`
Main component that handles all celebration animations and confetti.

### `QuranQuizCelebration` (Deprecated)
Legacy component - now wraps CelebrationModal for backward compatibility.

## Celebration Types

```typescript
type CelebrationType = 
  | 'quiz'              // Quiz completion (80 confetti, 3s)
  | 'surah-memorized'   // Completed memorizing a full Surah (150 confetti, 4s)
  | 'juz-memorized'     // Completed memorizing a full Juz (200 confetti, 5s)
  | 'surah-revised'     // Completed revising a full Surah (100 confetti, 3.5s)
  | 'juz-revised'       // Completed revising a full Juz (120 confetti, 4s)
```

Each type has optimized confetti count and duration for the appropriate level of celebration!

## Usage Examples

### Basic Usage with Hook

```typescript
import { useCelebration } from '@/hooks/useCelebration';
import CelebrationModal from '@/components/CelebrationModal';

function MyComponent() {
  const { 
    celebrationVisible, 
    celebrationType, 
    customMessage,
    showCelebration, 
    hideCelebration 
  } = useCelebration();

  const handleSurahCompleted = () => {
    // Show celebration for completing a Surah
    showCelebration('surah-memorized');
  };

  const handleJuzCompleted = () => {
    // Show celebration for completing a Juz
    showCelebration('juz-memorized');
  };

  return (
    <>
      <Button onPress={handleSurahCompleted}>Complete Surah</Button>
      <Button onPress={handleJuzCompleted}>Complete Juz</Button>
      
      <CelebrationModal
        visible={celebrationVisible}
        type={celebrationType}
        customMessage={customMessage}
        onComplete={hideCelebration}
      />
    </>
  );
}
```

### Direct Usage (Without Hook)

```typescript
import CelebrationModal from '@/components/CelebrationModal';
import { useState } from 'react';

function MyComponent() {
  const [showCelebration, setShowCelebration] = useState(false);

  const handleRevisionComplete = () => {
    setShowCelebration(true);
  };

  return (
    <>
      <Button onPress={handleRevisionComplete}>Finish Revision</Button>
      
      <CelebrationModal
        visible={showCelebration}
        type="surah-revised"
        onComplete={() => setShowCelebration(false)}
      />
    </>
  );
}
```

### Custom Message

```typescript
const customMessage = {
  arabic: "ما شاء الله!",
  english: "You've completed Surah Al-Baqarah! An incredible achievement!",
  emoji: "🎉"
};

showCelebration('surah-memorized', customMessage);
```

## Integration Points

### When to Trigger Celebrations

1. **Surah Memorized**: When the last verse of a Surah is marked as memorized
2. **Juz Memorized**: When all verses in a Juz are marked as memorized
3. **Surah Revised**: When all verses of a previously memorized Surah are revised
4. **Juz Revised**: When all verses of a previously memorized Juz are revised
5. **Quiz**: When quiz is completed successfully (existing)

### Suggested Implementation Locations

#### In `app/(tabs)/read.tsx` or verse marking components:

```typescript
const markVerseAsMemorized = async (verseId: number) => {
  // Mark verse as memorized
  await logVerseMemorization(verseId);
  
  // Check if this completes a Surah
  const surahComplete = await checkIfSurahComplete(surahId);
  if (surahComplete) {
    showCelebration('surah-memorized');
  }
  
  // Check if this completes a Juz
  const juzComplete = await checkIfJuzComplete(juzNumber);
  if (juzComplete) {
    showCelebration('juz-memorized');
  }
};
```

#### In revision flow:

```typescript
const markSurahAsRevised = async (surahId: number) => {
  // Mark all verses as revised
  await bulkLogRevisions(surahVerseIds);
  
  // Show celebration for completing revision
  showCelebration('surah-revised');
};
```

## Pre-configured Messages

Each celebration type has 4-5 pre-configured Islamic messages that are randomly selected. Messages include:
- Arabic phrase (ما شاء الله, بارك الله فيك, etc.)
- Encouraging English message
- Relevant emoji

## Customization

### Confetti Settings (Optimized for Performance)
**Reduced counts for 60fps on mid-range devices:**
- **Quiz**: 30 pieces, 3 second duration
- **Surah Memorized**: 60 pieces, 4 second duration  
- **Juz Memorized**: 80 pieces, 5 second duration (biggest celebration!)
- **Surah Revised**: 40 pieces, 3.5 second duration
- **Juz Revised**: 50 pieces, 4 second duration

> **Performance Note**: These counts are optimized for smooth 60fps on mid-range Android devices. If you experience lag, you can further reduce counts in `CONFETTI_CONFIG` in `CelebrationModal.tsx`.

Colors: Gold, Red, Teal, Blue, Green, Yellow, Purple, Mint
Fall duration: 2.5-4.5 seconds with random delays for staggered effect

### Animation Timing
- Fade in: 500ms
- Auto-closes after celebration duration
- Fade out: 500ms
- Uses native driver for smooth 60fps animations

### Performance Monitoring
In development mode (`__DEV__`), performance logs are automatically enabled:
```
[Celebration] Starting surah-memorized with 60 confetti pieces
[Celebration] surah-memorized completed in 4123ms
[Celebration] TIP: If experiencing lag, reduce confetti count
```

## Performance Testing Checklist

Before deploying to production, test on:
- ✅ Mid-range Android device (not flagship)
- ✅ Record screen at 60fps during celebration
- ✅ Check FPS counter stays above 55fps
- ✅ Test with multiple celebrations in quick succession

**Performance Targets:**
- ✅ 55-60 FPS = Excellent (ship it!)
- ⚠️ 40-54 FPS = Consider reducing counts by 30%
- ❌ Below 40 FPS = Reduce counts by 50% or consider library

## Fallback Plan

If performance issues arise in production, you can:

1. **Reduce confetti counts** in `CONFETTI_CONFIG`
2. **Install react-native-confetti-cannon** as backup:
   ```bash
   npm install react-native-confetti-cannon
   ```
3. **Feature flag approach** (if needed):
   ```typescript
   import DeviceInfo from 'react-native-device-info';
   
   const USE_LIBRARY = Platform.OS === 'android' && DeviceInfo.isLowEnd();
   ```

## Performance Notes
- Uses native driver for smooth 60fps animations
- Confetti pieces are efficiently animated
- Modal is unmounted when not visible
- No heavy computations during animation
