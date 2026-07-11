const fs = require('fs');
const path = require('path');

const files = [
  'components/BulkProgressModal.tsx',
  'components/DayPlannerModal.tsx',
  'components/fasting/context/DayDetailModal.tsx',
  'components/MushafRepeatModal.tsx',
  'components/PageModeConfig.tsx',
  'components/PageModeScopeSelector.tsx',
  'components/PageSettings.tsx',
  'components/ReviewSoftPrompt.tsx',
  'components/SadaqahPrompt.tsx',
  'components/SurahRangePicker.tsx',
  'components/TafsirModal.tsx',
  'components/UpdateModal.tsx',
];

for (const file of files) {
  const filePath = path.join('/Users/ahnaf/Documents/Aleem/ihafidh3', file);
  if (!fs.existsSync(filePath)) {
    console.log('Not found:', file);
    continue;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  
  const regex = /(export (?:default )?function\s+\w+\s*\(\{\s*)(React\.useEffect\(\(\)\s*=>\s*\{\s*if\s*\(visible\)\s*\{\s*logScreenView\([^)]*\)\.catch\(\(\)\s*=>\s*\{\}\);\s*\}\s*\},\s*\[visible\]\);\s*)([\s\S]*?)(:\s*\w+(?:Props|Config)(?:<[^>]+>)?\)\s*\{)/g;

  if (regex.test(content)) {
    content = content.replace(regex, (match, p1, p2, p3, p4) => {
      return p1 + p3.replace(/^\s+/, '') + p4 + '\n' + p2;
    });
    fs.writeFileSync(filePath, content);
    console.log('Fixed', file);
  } else {
    const regex2 = /(export (?:default )?function\s+\w+\s*\(\{\s*)(React\.useEffect\(\(\)\s*=>\s*\{\s*if\s*\(visible\)\s*\{\s*logScreenView\([^)]*\)\.catch\(\(\)\s*=>\s*\{\}\);\s*\}\s*\},\s*\[visible\]\);\s*)([\s\S]*?)(\}\)\s*\{)/g;
    if (regex2.test(content)) {
      content = content.replace(regex2, (match, p1, p2, p3, p4) => {
        return p1 + p3.replace(/^\s+/, '') + p4 + '\n' + p2;
      });
      fs.writeFileSync(filePath, content);
      console.log('Fixed (no props typing)', file);
    } else {
      console.log('Pattern not found in', file);
    }
  }
}
