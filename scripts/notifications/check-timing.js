#!/usr/bin/env node

/**
 * Notification Timing Checker
 * Shows which UTC hours trigger notifications for your timezone
 */

console.log('═'.repeat(70));
console.log('⏰ NOTIFICATION TIMING DIAGNOSTIC');
console.log('═'.repeat(70));
console.log();

const now = new Date();
const currentUTCHour = now.getUTCHours();

console.log('📅 Current Date/Time:');
console.log(`   UTC:       ${now.toISOString()}`);
console.log(`   Local:     ${now.toLocaleString()}`);
console.log(`   UTC Hour:  ${currentUTCHour}:00`);
console.log();

// Get user's local timezone offset
const offsetMinutes = -now.getTimezoneOffset();
const offsetHours = offsetMinutes / 60;
const sign = offsetHours >= 0 ? '+' : '';
const offsetStr = `${sign}${String(Math.abs(Math.floor(offsetHours))).padStart(2, '0')}00`;

console.log('🌍 Your Timezone:');
console.log(`   Offset: UTC${sign}${offsetHours}`);
console.log(`   Topic Format: broadcast_${offsetStr}, fasting_${offsetStr}, daily_ayah_${offsetStr}`);
console.log();

// Calculate when GitHub Actions will send for this timezone
const TARGET_HOUR = 5; // 5 AM local
let triggerUTCHour = TARGET_HOUR - offsetHours;
if (triggerUTCHour < 0) triggerUTCHour += 24;
if (triggerUTCHour >= 24) triggerUTCHour -= 24;

console.log('⏰ Notification Schedule:');
console.log(`   Target Time: ${TARGET_HOUR}:00 AM (your local time)`);
console.log(`   GitHub Actions will trigger at: ${Math.floor(triggerUTCHour)}:00 UTC`);
console.log(`   Which is: ${TARGET_HOUR}:00 AM in your timezone`);
console.log();

// Show next few hours
console.log('📊 Next 24 Hours Schedule:');
console.log('─'.repeat(70));
console.log('UTC Hour | Your Local Time | Will Send?');
console.log('─'.repeat(70));

for (let utcHour = 0; utcHour < 24; utcHour++) {
    let localHour = (utcHour + offsetHours);
    if (localHour < 0) localHour += 24;
    if (localHour >= 24) localHour -= 24;
    
    const willSend = localHour === TARGET_HOUR ? '✅ YES - Sends notifications!' : '❌ No';
    const marker = utcHour === currentUTCHour ? '👉 NOW' : '';
    
    console.log(
        `${String(utcHour).padStart(2, '0')}:00    | ` +
        `${String(Math.floor(localHour)).padStart(2, '0')}:${String(Math.floor((localHour % 1) * 60)).padStart(2, '0')}            | ` +
        `${willSend} ${marker}`
    );
}

console.log('─'.repeat(70));
console.log();

// Check if we're currently in the send window
const currentLocalHour = (currentUTCHour + offsetHours + 24) % 24;
const isCurrentlySending = Math.floor(currentLocalHour) === TARGET_HOUR;

if (isCurrentlySending) {
    console.log('🎯 RIGHT NOW: GitHub Actions SHOULD be sending notifications!');
    console.log('   If you don\'t receive notifications, check:');
    console.log('   1. GitHub Actions logs (should show your timezone in "Found X timezone(s)")');
    console.log('   2. App Settings > Enable Fasting Reminders & Daily Ayah');
    console.log('   3. Device notification permissions');
} else {
    const hoursUntilNext = ((Math.floor(triggerUTCHour) - currentUTCHour + 24) % 24);
    console.log(`⏳ WAITING: Notifications will be sent in ~${hoursUntilNext} hours`);
    console.log(`   Next send time: ${Math.floor(triggerUTCHour)}:00 UTC (${TARGET_HOUR}:00 AM your time)`);
}

console.log();
console.log('💡 How to Check GitHub Actions Logs:');
console.log('   1. Go to: https://github.com/aishiek/ihafidh3/actions');
console.log('   2. Click "Daily Notifications" workflow');
console.log(`   3. Look for runs at ${Math.floor(triggerUTCHour)}:00 UTC`);
console.log('   4. Check logs for: "Found X timezone(s) hitting 5 AM"');
console.log('   5. Download "notification-logs" artifact if available');
console.log();
console.log('═'.repeat(70));
