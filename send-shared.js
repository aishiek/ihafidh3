function sanitizeOffsetForTopic(offset) {
    return offset.replace(/\+/g, 'plus').replace(/-/g, 'minus');
}

// Existing function offsetToString goes here

// ... (existing content above line 141) 

// Update line 141
const topicName1 = sanitizeOffsetForTopic(zone.str);

// ... (existing content between lines 141 and 215)

// Update line 215
const topicName2 = sanitizeOffsetForTopic(zone.str);

// ... (any remaining content below line 215)
