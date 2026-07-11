const fs = require('fs');

const files = [
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
  'components/PageModeConfig.tsx',
  'components/PageModeScopeSelector.tsx',
  'components/PageSettings.tsx',
  'components/SurahRangePicker.tsx',
  'components/VerseItem.tsx'
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let code = fs.readFileSync(file, 'utf8');

  // Skip if already tracked
  if (code.includes('logScreenView(') || code.includes('logScreenView:')) continue;
  
  // Find visible prop name (usually `visible`, sometimes `modalVisible`)
  const hasVisible = code.includes('visible');
  const hasModalVisible = code.includes('modalVisible');
  
  if (!hasVisible && !hasModalVisible) {
     console.log('Skipping ' + file + ' (no visible state found)');
     continue;
  }

  // Inject import
  if (!code.includes('utils/analyticsHelper')) {
      code = "import { logScreenView } from '@/utils/analyticsHelper';\n" + code;
  } else {
      code = code.replace(/import \{([^}]+)\} from '@\/utils\/analyticsHelper';/, (match, p1) => {
          if (p1.includes('logScreenView')) return match;
          return `import { ${p1}, logScreenView } from '@/utils/analyticsHelper';`;
      });
  }
  
  // Extract modal name
  const nameMatch = file.match(/([A-Za-z0-9]+)\.tsx/);
  const name = nameMatch ? nameMatch[1] : 'UnknownModal';

  const stateName = hasModalVisible && file.includes('VerseItem') ? 'modalVisible' : 'visible';

  // Inject useEffect inside the main component
  // Usually right after `const [..., set...] = useState(...)` or similar
  // Let's just place it before the first `return (` in the file.
  // This is a bit hacky but works for most components.
  
  // But components can have multiple returns. We want the last return, or better, after the component declaration.
  // Actually, we can inject a functional component wrapper or just a simple hook if we find the component definition.
  
  const componentPattern = new RegExp(`(export\\s+default\\s+function\\s+${name}[\\s\\S]*?)\\{|const\\s+${name}\\s*=\\s*\\([^)]*\\)\\s*=>\\s*\\{`);
  
  code = code.replace(componentPattern, (match) => {
      return match + `\n  React.useEffect(() => {\n    if (${stateName}) {\n      logScreenView('modal_${name.toLowerCase()}').catch(() => {});\n    }\n  }, [${stateName}]);\n`;
  });

  fs.writeFileSync(file, code);
  console.log('Patched ' + file);
}
