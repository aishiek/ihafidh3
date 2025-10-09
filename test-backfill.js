// Simple test script to force backfill
const { exec } = require('child_process');

console.log('Opening Expo development environment to run backfill...');
console.log('Please run these commands in your app console:');
console.log('');
console.log('1. Open your app on device/simulator');
console.log('2. Open development console (press j in terminal or use debugger)');
console.log('3. Run these commands:');
console.log('');
console.log('import { forceBackfillNow, debugVerseActivityCounts } from "./database/QuranDatabase";');
console.log('await forceBackfillNow();');
console.log('await debugVerseActivityCounts();');
console.log('');
console.log('This will populate your verse_activities table with historical data from your 2228 memorized verses.');