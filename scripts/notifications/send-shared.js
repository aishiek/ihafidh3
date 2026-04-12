function sanitizeOffsetForTopic(offset) {
    return offset.replace(/\+/g, 'plus').replace(/-/g, 'minus');
}

// Existing function
function offsetToString(offset) {
    //Your offsetToString implementation here
}

// Update ayahTopic and fastingTopic

// Line 141 Update - use sanitizeOffsetForTopic
ayahTopic = sanitizeOffsetForTopic(zone.str);

// Line 215 Update - use sanitizeOffsetForTopic
fastingTopic = sanitizeOffsetForTopic(zone.str);
