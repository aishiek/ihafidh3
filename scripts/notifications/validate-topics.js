#!/usr/bin/env node

/**
 * Validate FCM topic names for compliance with Firebase rules
 * 
 * FCM Topic Requirements:
 * - Allowed: a-z A-Z 0-9 _ - . ~ %
 * - NOT allowed: + (plus sign), spaces, #, $, &, /, etc.
 * - Max length: 900 characters
 * - Regex: /^[a-zA-Z0-9-_.~%]+$/
 */

const VALID_TOPIC_REGEX = /^[a-zA-Z0-9\-_.~%]+$/;

function validateTopic(topic) {
    const errors = [];
    
    if (!topic || topic.length === 0) {
        errors.push('Topic is empty');
    }
    
    if (topic.length > 900) {
        errors.push(`Topic too long: ${topic.length} chars (max 900)`);
    }
    
    if (!VALID_TOPIC_REGEX.test(topic)) {
        errors.push('Contains invalid characters');
        
        // Find specific invalid characters
        const invalid = topic.split('').filter(c => !/[a-zA-Z0-9\-_.~%]/.test(c));
        if (invalid.length > 0) {
            errors.push(`Invalid chars: ${[...new Set(invalid)].join(', ')}`);
        }
    }
    
    if (topic.includes('+')) {
        errors.push('Contains + (plus sign) - NOT ALLOWED in FCM topics');
    }
    
    if (topic.includes(' ')) {
        errors.push('Contains spaces - NOT ALLOWED in FCM topics');
    }
    
    return errors;
}

console.log('═'.repeat(70));
console.log('FCM TOPIC NAME VALIDATOR');
console.log('═'.repeat(70));
console.log();

// Test all possible timezone topics
const testTopics = [
    // Valid examples (should pass)
    'broadcast_0800',
    'fasting_0800',
    'daily_ayah_0800',
    'broadcast_-0500',
    'fasting_-1100',
    'daily_ayah_1400',
    
    // Invalid examples (should fail)
    'broadcast_+0800',  // Plus sign
    'fasting +0800',    // Space
    'daily_ayah#0800',  // Hash
    'timezone$0800',    // Dollar sign
];

let passCount = 0;
let failCount = 0;

testTopics.forEach(topic => {
    const errors = validateTopic(topic);
    
    if (errors.length === 0) {
        console.log(`✅ VALID: ${topic}`);
        passCount++;
    } else {
        console.log(`❌ INVALID: ${topic}`);
        errors.forEach(err => console.log(`   • ${err}`));
        failCount++;
    }
});

console.log();
console.log('─'.repeat(70));
console.log(`Results: ${passCount} valid, ${failCount} invalid`);
console.log('═'.repeat(70));
console.log();

// Generate all timezones used by the app
console.log('📋 APP TOPIC NAMES (Generated):');
console.log('─'.repeat(70));

const types = ['broadcast', 'fasting', 'daily_ayah'];
const offsets = [];

// Generate UTC-11 to UTC+14
for (let offset = -11; offset <= 14; offset++) {
    const sign = offset >= 0 ? '' : '-';
    const abs = Math.abs(offset);
    const offsetStr = `${sign}${String(abs).padStart(2, '0')}00`;
    offsets.push(offsetStr);
}

console.log(`Checking ${types.length} types × ${offsets.length} timezones = ${types.length * offsets.length} topics\n`);

let allValid = true;
for (const type of types) {
    for (const offset of offsets) {
        const topic = `${type}_${offset}`;
        const errors = validateTopic(topic);
        
        if (errors.length > 0) {
            console.log(`❌ ${topic}`);
            errors.forEach(err => console.log(`   ${err}`));
            allValid = false;
        }
    }
}

if (allValid) {
    console.log('✅ ALL APP TOPICS ARE VALID');
} else {
    console.log('❌ SOME APP TOPICS ARE INVALID - FIX REQUIRED');
}

console.log();
console.log('═'.repeat(70));
