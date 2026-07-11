const fs = require('fs');

let content = fs.readFileSync('components/VerseItem.tsx', 'utf8');

// Chunk 1
content = content.replace(
  `const getSurahId = (verse: Verse): number | null => {
  const surahId = verse.surahId || (verse as any).surahNumber || verse.surah?.number;
  return surahId || null;
};

const VerseItem = ({`,
  `const getSurahId = (verse: Verse): number | null => {
  const surahId = verse.surahId || (verse as any).surahNumber || verse.surah?.number;
  return surahId || null;
};

const DEFAULT_TRANSLATION = '';

const VerseItem = ({`
);

// Chunk 2
content = content.replace(
  `  const [showPlaybackModal, setShowPlaybackModal] = useState(false);
  const [showTafsirModal, setShowTafsirModal] = useState(false);
  // per-verse Go modal (small, opens to jump to a verse via moveToVerse prop)
  const [showGoModal, setShowGoModal] = useState(false);
  const [goInput, setGoInput] = useState('');
  const [goInputError, setGoInputError] = useState<string | null>(null);
  const [goSubmitting, setGoSubmitting] = useState(false);`,
  `  // per-verse Go modal (small, opens to jump to a verse via moveToVerse prop)
  const [uiState, setUiState] = useState({
    showPlaybackModal: false,
    showTafsirModal: false,
    showGoModal: false,
    goInput: '',
    goInputError: null as string | null,
    goSubmitting: false,
  });
  const { showPlaybackModal, showTafsirModal, showGoModal, goInput, goInputError, goSubmitting } = uiState;`
);

// Chunk 3
content = content.replace(
  `    setShowPlaybackModal(false);
    setShowTafsirModal(false);
    setShowGoModal(false);
    setGoInput('');
    setGoInputError(null);
    setGoSubmitting(false);`,
  `    setUiState({
      showPlaybackModal: false,
      showTafsirModal: false,
      showGoModal: false,
      goInput: '',
      goInputError: null,
      goSubmitting: false,
    });`
);

// Chunk 4
content = content.replace(
  `  const defaultTranslation = '';`,
  ``
);

// Chunk 5
content = content.replace(
  `  }, [arabicFont, (verse as any).tajweedText, localData.arabic, arabicText, isBasmalah]);`,
  `  }, [arabicFont, (verse as any).tajweedText, localData.verseId, localData.arabic, arabicText, isBasmalah, verse.id]);`
);

// Chunk 6
content = content.replace(
  `defaultTranslation, verse.id]);`,
  `DEFAULT_TRANSLATION, verse.id]);`
);
content = content.replace(
  `verse.translation || defaultTranslation;`,
  `verse.translation || DEFAULT_TRANSLATION;`
);

// Chunk 7
content = content.replace(
  `setShowTafsirModal(true);`,
  `setUiState(s => ({ ...s, showTafsirModal: true }));`
);

// Chunk 8
content = content.replace(
  `  // Load verse data from local DB
  useEffect(() => {
    if (!surahId || loadingStartedRef.current) return;

    // CRITICAL FIX: Skip local DB loading if we already have the primary required texts
    // This stops redundant state updates and Double-Render flickering on Android
    const hasArabic = typeof verse.arabicText === 'string' && verse.arabicText.length > 0;
    const hasTranslation = typeof verse.translation === 'string' && verse.translation.length > 0;
    const hasTajweed = arabicFont === 'tajweed' ? typeof (verse as any).tajweedText === 'string' : true;
    
    if (hasArabic && hasTranslation && hasTajweed) {
      return; // Skip fetch entirely
    }

    loadingStartedRef.current = true;`,
  `  const needsLocalDB = useMemo(() => {
    const hasArabic = typeof verse.arabicText === 'string' && verse.arabicText.length > 0;
    const hasTranslation = typeof verse.translation === 'string' && verse.translation.length > 0;
    const hasTajweed = arabicFont === 'tajweed' 
      ? typeof (verse as any).tajweedText === 'string' && (verse as any).tajweedText.length > 0
      : true;
    return !(hasArabic && hasTranslation && hasTajweed);
  }, [verse.arabicText, verse.translation, (verse as any).tajweedText, arabicFont]);

  // Load verse data from local DB
  useEffect(() => {
    if (!surahId || loadingStartedRef.current || !needsLocalDB) return;

    loadingStartedRef.current = true;`
);

// Replaces for other setState calls
content = content.replace(/setShowPlaybackModal\(true\)/g, `setUiState(s => ({ ...s, showPlaybackModal: true }))`);
content = content.replace(/setShowPlaybackModal\(false\)/g, `setUiState(s => ({ ...s, showPlaybackModal: false }))`);
content = content.replace(/setShowTafsirModal\(false\)/g, `setUiState(s => ({ ...s, showTafsirModal: false }))`);
content = content.replace(/setShowGoModal\(false\)/g, `setUiState(s => ({ ...s, showGoModal: false }))`);

content = content.replace(
  `onChangeText={(t) => { setGoInput(t); setGoInputError(null); }}`,
  `onChangeText={(t) => { setUiState(s => ({ ...s, goInput: t, goInputError: null })); }}`
);

content = content.replace(
  `onPress={() => { setShowGoModal(false); setGoInput(''); setGoInputError(null); }}`,
  `onPress={() => { setUiState(s => ({ ...s, showGoModal: false, goInput: '', goInputError: null })); }}`
);

content = content.replace(
  `setGoInputError(null);`,
  `setUiState(s => ({ ...s, goInputError: null }));`
);

content = content.replace(
  `setGoInputError(\`Enter a number between 1 and \${maxVerse}\`);`,
  `setUiState(s => ({ ...s, goInputError: \`Enter a number between 1 and \${maxVerse}\` }));`
);

content = content.replace(
  `setGoInputError('Navigation handler not available');`,
  `setUiState(s => ({ ...s, goInputError: 'Navigation handler not available' }));`
);

content = content.replace(
  `setGoSubmitting(true);`,
  `setUiState(s => ({ ...s, goSubmitting: true }));`
);

content = content.replace(
  `setShowGoModal(false);
                    setGoInput('');`,
  `setUiState(s => ({ ...s, showGoModal: false, goInput: '' }));`
);

content = content.replace(
  `setGoInputError('Failed to jump.');`,
  `setUiState(s => ({ ...s, goInputError: 'Failed to jump.' }));`
);

content = content.replace(
  `setGoSubmitting(false);`,
  `setUiState(s => ({ ...s, goSubmitting: false }));`
);

fs.writeFileSync('components/VerseItem.tsx', content, 'utf8');
