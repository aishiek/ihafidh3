const fs = require('fs');
const path = require('path');

const files = [
  'components/QuranThemedModal/index.tsx',
  'components/TafsirModal.tsx',
  'components/UpdateModal.tsx',
  'components/AnnouncementModal.tsx',
  'components/CelebrationModal.tsx',
  'components/DayPlannerModal.tsx',
  'components/SadaqahPrompt.tsx',
  'components/ReviewSoftPrompt.tsx',
  'components/fasting/context/DayDetailModal.tsx',
  'components/BulkProgressModal.tsx',
  'components/MushafRepeatModal.tsx',
  'components/OccasionHeaderIcon.tsx',
  'components/PageModeConfig.tsx',
  'components/PageModeScopeSelector.tsx',
  'components/PageSettings.tsx',
  'components/SurahRangePicker.tsx',
  'components/VerseItem.tsx'
];

for (const file of files) {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (content.includes('logScreenView(')) continue;
  
  const modalNameMatch = file.match(/([A-Za-z0-9]+)\.tsx/);
  const modalName = modalNameMatch ? modalNameMatch[1] : 'Modal';
  
  // Add import if needed
  if (!content.includes('import { logScreenView }')) {
    if (!content.includes('utils/analyticsHelper')) {
        content = `import { logScreenView } from '@/utils/analyticsHelper';\n` + content;
    } else {
        content = content.replace(/import \{([^}]+)\} from '@\/utils\/analyticsHelper';/, (match, p1) => {
            return `import { ${p1}, logScreenView } from '@/utils/analyticsHelper';`;
        });
    }
  }

  // Check where to inject the useEffect
  // Find visible prop if it exists
  const isVerseItem = file.includes('VerseItem');
  if (isVerseItem) {
     content = content.replace(/const VerseItem = \(\{([^)]+)\}\) => \{/, (match) => {
         return match + `\n  React.useEffect(() => {\n    if (modalVisible) logScreenView('VerseItem_Modal');\n  }, [modalVisible]);\n`;
     });
     // VerseItem might not have modalVisible but let's check manually later if needed.
  } else {
     // A generic react component usually starts with: `const ComponentName = ({ visible, ... }) => {`
     // Let's find `return (` or `useEffect` and insert before it. 
     // Easier to just use `replace_file_content` for the main ones.
  }
}
