const fs = require('fs');
const path = require('path');
const assert = require('assert');

const modalPath = path.resolve(__dirname, '../components/AnnouncementModal.tsx');
const src = fs.readFileSync(modalPath, 'utf8');

// Ensure we set up an auto-close timer for non-dismissible announcements
assert(src.includes('setTimeout(') || src.includes('autoCloseTimer'), 'AnnouncementModal should set an auto-close timer for non-dismissible announcements');
assert(src.includes('announcement.dismissible') || src.includes('dismissible'), 'AnnouncementModal should check announcement.dismissible to decide auto-close');
assert(src.includes('Auto-closing in') || src.includes('remainingSeconds'), 'AnnouncementModal should include a visible countdown hint (remainingSeconds or string)');

console.log('✅ AnnouncementModal auto-close static checks present');
