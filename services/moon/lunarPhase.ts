// lunarPhase.ts - Phase 1 MVP local lunar phase calculations and caching (reverted to original simplified version)
// No external API required.

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LunarPhaseData {
  date: string; // YYYY-MM-DD
  ageDays: number; // age since new moon
  illumination: number; // 0..1
  phaseName: string;
  cycleProgress: number; // 0..1
  nextNewMoon: string; // ISO
  nextFullMoon: string; // ISO
}

// Synodic month length (mean)
const SYNODIC_MONTH = 29.530588;
// Reference New Moon: Jan 6 2000 18:14 UTC (JD 2451550.1) widely used baseline
const REF_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14, 0, 0); // ms

const STORAGE_PREFIX = 'moon_phase_';

function clamp(v: number, min: number, max: number) { return Math.min(max, Math.max(min, v)); }

function normalize(value: number, modulo: number) { return ((value % modulo) + modulo) % modulo; }

export function computeLunarData(date: Date = new Date()): LunarPhaseData {
  const nowUTC = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds()
  );
  const daysSinceRef = (nowUTC - REF_NEW_MOON) / 86400000; // ms -> days
  const age = normalize(daysSinceRef, SYNODIC_MONTH);
  const cycleProgress = age / SYNODIC_MONTH; // 0..1
  // Simple illumination model
  const illumination = 0.5 * (1 - Math.cos(2 * Math.PI * cycleProgress)); // 0..1

  // Phase name thresholds (approx)
  const phaseName = (() => {
    if (age < 1) return 'New Moon';
    if (age < 6.382) return 'Waxing Crescent';
    if (age < 8.382) return 'First Quarter';
    if (age < 13.765) return 'Waxing Gibbous';
    if (age < 15.765) return 'Full Moon';
    if (age < 21.147) return 'Waning Gibbous';
    if (age < 23.147) return 'Last Quarter';
    if (age < 28) return 'Waning Crescent';
    return 'New Moon';
  })();

  // Next full moon (approx at age 14.765) and next new moon (age 29.53 or 0) based on current age
  const daysToFull = age <= 14.765 ? 14.765 - age : (SYNODIC_MONTH - age) + 14.765;
  const daysToNew = SYNODIC_MONTH - age;

  const nextFull = new Date(nowUTC + daysToFull * 86400000).toISOString();
  const nextNew = new Date(nowUTC + daysToNew * 86400000).toISOString();

  return {
    date: date.toISOString().slice(0,10),
    ageDays: age,
    illumination: clamp(illumination, 0, 1),
    phaseName,
    cycleProgress: clamp(cycleProgress, 0, 1),
    nextNewMoon: nextNew,
    nextFullMoon: nextFull
  };
}

export async function getLunarPhaseCached(date: Date = new Date()): Promise<LunarPhaseData> {
  const key = STORAGE_PREFIX + date.toISOString().slice(0,10);
  try {
    const cached = await AsyncStorage.getItem(key);
    if (cached) return JSON.parse(cached);
  } catch {}
  const data = computeLunarData(date);
  try { await AsyncStorage.setItem(key, JSON.stringify(data)); } catch {}
  return data;
}
