const fs = require('fs');
const path = require('path');
const assert = require('assert');

const layoutPath = path.resolve(__dirname, '../app/(tabs)/_layout.tsx');
const layoutSrc = fs.readFileSync(layoutPath, 'utf8');

assert(layoutSrc.includes("OccasionHeaderIcon"), '_layout should import and use OccasionHeaderIcon in headerRight');
assert(layoutSrc.includes('headerRight') && layoutSrc.includes('EnhancedHamburgerMenu'), 'headerRight should include EnhancedHamburgerMenu and the icon');

console.log('✅ _layout header wiring looks correct');
