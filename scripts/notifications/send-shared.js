// Convert offset number to timezone string format for Firebase topics (alphanumeric only)
// Example: 5.5 -> "plus0530", -9.5 -> "minus0930"
function offsetToString(offset) {
    const sign = offset < 0 ? '-' : '+';
    const abs = Math.abs(offset);
    const h = Math.floor(abs);
    const m = (abs % 1) * 60;
    return `${sign}${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}`;
}

// Convert offset to Firebase-compatible topic name (no +/- characters)
function sanitizeOffsetForTopic(offset) {
    const sign = offset < 0 ? 'minus' : 'plus';
    const abs = Math.abs(offset);
    const h = Math.floor(abs);
    const m = (abs % 1) * 60;
    return `${sign}${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}`;
}

const ayahTopic = `${TOPIC_DAILY_AYAH}_${sanitizeOffsetForTopic(zone.val)}`;

const fastingTopic = `${TOPIC_FASTING}_${sanitizeOffsetForTopic(zone.val)}`;