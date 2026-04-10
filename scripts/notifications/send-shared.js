// Other parts of the script remain unchanged

function getDailyAyah(dayOfYear) {
    // Subtract 1 from dayOfYear to match app logic
    return someLogicToFetchAyah(dayOfYear - 1);
}

// ...

// Replace timezone offset loop with support for fractional offsets
const timezoneOffsets = [-9.5, -3.5, 4.5, 5.5, 5.75, 8.75, 12.75, 13];
const timezoneStrings = timezoneOffsets.map(offset => {
    const sign = offset < 0 ? '-' : '+';
    const hours = Math.abs(Math.floor(offset));
    const minutes = Math.abs((offset % 1) * 60);
    return `${sign}${String(hours).padStart(2, '0')}${String(minutes).padStart(2, '0')}`;
});

// Use timezoneStrings wherever necessary
// Other functionality remains as it was
