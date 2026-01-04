const fs = require('fs');
const path = require('path');
const assert = require('assert');

const modalPath = path.resolve(__dirname, '../components/AnnouncementModal.tsx');
const modalSource = fs.readFileSync(modalPath, 'utf8');

assert(modalSource.includes('RenderHtml'), 'AnnouncementModal should use RenderHtml for HTML content');
assert(modalSource.includes('announcement.actionButton'), 'AnnouncementModal should support actionButton routing');

console.log('✅ AnnouncementModal static checks passed');

const servicePath = path.resolve(__dirname, '../services/AnnouncementService.ts');
const serviceSource = fs.readFileSync(servicePath, 'utf8');

assert(serviceSource.includes('VERSION_URL'), 'AnnouncementService should include a VERSION_URL constant');
assert(serviceSource.includes('getAnnouncementToDisplay'), 'AnnouncementService should expose getAnnouncementToDisplay');

console.log('✅ AnnouncementService static checks passed');
