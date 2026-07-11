/**
 * Feature Guide — help.tsx
 * Redesigned with actual app icons, inline icon demos, and expandable cards.
 */
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import {
  BarChart2,
  Bookmark,
  BookOpen,
  Calendar,
  Check,
  Heart,
  HelpCircle,
  Info,
  Layers,
  LayoutTemplate,
  MapPin,
  Menu,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Search as SearchIcon,
  Smartphone,
  Sparkles,
  Sun,
  Target,
  Type,
  Users,
} from 'lucide-react-native';
import { WBWIcon } from '@/components/icons/WBWIcon';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Types ─────────────────────────────────────────────────────────────────

type Category = 'Reading' | 'Memorization' | 'Progress & Review' | 'Settings' | 'Extras';

interface IconDemo {
  /** Small row of icons shown inside the card as a visual preview */
  icons: { component: any; color: string; label: string; isCustom?: boolean }[];
}

interface FeatureItem {
  id: string;
  icon: any;
  iconColor?: string;
  isCustomIcon?: boolean;
  title: string;
  description: string;
  tip?: string;
  where?: string;      // "Where to find it" short string
  iconDemo?: IconDemo; // inline icon row
  category: Category;
}

// ─── Feature Definitions ────────────────────────────────────────────────────

const FEATURES: FeatureItem[] = [
  // ── Reading ──────────────────────────────────────────────────────────────
  {
    id: 'surah_list',
    icon: BookOpen,
    iconColor: '#D4AF37',
    category: 'Reading',
    title: 'Browse by Surah',
    description:
      'The Recite tab opens to a full list of all 114 Surahs. Each card shows ' +
      'your memorization percentage and last-read date at a glance.',
    where: 'Recite tab → Surah tab',
    tip: 'If you are reading a Surah and want to quickly return to this list, simply tap the "Recite" tab icon at the bottom again!',
    iconDemo: {
      icons: [
        { component: SearchIcon, color: '#D4AF37', label: 'Search' },
        { component: BookOpen, color: '#D4AF37', label: 'Surah' },
        { component: Layers, color: '#888', label: 'Juz' },
      ],
    },
  },
  {
    id: 'juz_list',
    icon: Layers,
    iconColor: '#D4AF37',
    category: 'Reading',
    title: 'Browse by Juz',
    description:
      'Switch to the "Juz" tab to navigate all 30 traditional divisions of the Quran. ' +
      'Each Juz card shows combined progress across all its Surahs.',
    where: 'Recite tab → Juz tab',
    tip: 'Double-tap the Recite tab from anywhere in the app to instantly reset back to the Surah/Juz selection screen.',
    iconDemo: {
      icons: [
        { component: BookOpen, color: '#888', label: 'Surah' },
        { component: Layers, color: '#D4AF37', label: 'Juz ✓' },
      ],
    },
  },
  {
    id: 'read_mode',
    icon: Smartphone,
    iconColor: '#FFD700',
    category: 'Reading',
    title: 'Golden Read Mode',
    description:
      'While viewing any Surah or Juz, rotate your phone to landscape. ' +
      'The screen transforms into a premium gold-gradient full-screen reader ' +
      'built for deep focus, recitation and Word-by-Word study.',
    where: 'Recite tab → open any Surah/Juz → rotate phone',
    tip: 'Your exact scroll position is preserved when you rotate back to portrait.',
    iconDemo: {
      icons: [
        { component: Smartphone, color: '#FFD700', label: 'Rotate' },
        { component: Sun, color: '#D4AF37', label: 'Light' },
        { component: Play, color: '#D4AF37', label: 'Audio' },
      ],
    },
  },
  {
    id: 'wbw',
    icon: WBWIcon,
    iconColor: '#D4AF37',
    isCustomIcon: true,
    category: 'Reading',
    title: 'Word-by-Word Translation',
    description:
      'In landscape Read Mode, tap the WBW icon (two overlapping letter bubbles — ' +
      '"A" and "ع") in the top-right header to enable Word-by-Word mode. ' +
      'Each Arabic word then shows a small dot beneath it. Tap any word to see its ' +
      'translation float up in a pill at the bottom of the screen.',
    where: 'Read Mode header → WBW icon (A/ع bubbles)',
    tip: 'Long-press the WBW icon for a "Word by Word" tooltip reminder. Tap the pill to dismiss it.',
    iconDemo: {
      icons: [
        { component: WBWIcon, color: '#D4AF37', label: 'WBW', isCustom: true },
      ],
    },
  },
  {
    id: 'parchment_mode',
    icon: Sun,
    iconColor: '#E8C97A',
    category: 'Reading',
    title: 'Parchment Light Theme',
    description:
      'In landscape Read Mode, tap the ☀ (Sun) icon in the header to toggle between ' +
      'the dark gold theme and a warm parchment-cream theme — perfect for bright lighting.',
    where: 'Read Mode header → ☀ Sun icon',
    iconDemo: {
      icons: [
        { component: Sun, color: '#E8C97A', label: 'Light Mode' },
      ],
    },
  },
  {
    id: 'audio',
    icon: Play,
    iconColor: '#D4AF37',
    category: 'Reading',
    title: 'Audio Recitation',
    description:
      'Two levels of audio playback:\n\n' +
      '• Surah audio — tap ▶ or ⏸ in the Read Mode header to play the full Surah ' +
      'from your chosen reciter.\n\n' +
      '• Verse audio — tap the coloured ▶ button on any verse card in portrait mode ' +
      'to play that single ayah. Use the repeat selector (1×, 2×, 3×…) next to it.',
    where: 'Read Mode header (full surah) or verse card ▶ button',
    tip: 'Change your reciter any time in Settings → Reading Settings.',
    iconDemo: {
      icons: [
        { component: Play, color: '#D4AF37', label: 'Play' },
        { component: Pause, color: '#888', label: 'Pause' },
      ],
    },
  },
  {
    id: 'tafsir',
    icon: BookOpen,
    iconColor: '#9C27B0',
    category: 'Reading',
    title: 'Classical Tafsir',
    description:
      'Tap the 📖 (open book) icon on any verse card to open a full Tafsir modal. ' +
      'It shows scholarly commentary and historical context for that ayah.',
    where: 'Verse card → 📖 book icon (top-right of card)',
    iconDemo: {
      icons: [
        { component: BookOpen, color: '#9C27B0', label: 'Tafsir' },
      ],
    },
  },
  {
    id: 'bookmark',
    icon: Bookmark,
    iconColor: '#FFD700',
    category: 'Reading',
    title: 'Bookmark a Verse',
    description:
      'Tap the 🔖 (Bookmark) icon on any verse card — portrait or landscape — to save ' +
      'that verse to your Bookmarks list. A filled gold bookmark means it\'s saved.',
    where: 'Verse card → 🔖 bookmark icon · or in Read Mode card header',
    tip: 'Access all bookmarks via the ☰ Menu → Bookmarks.',
    iconDemo: {
      icons: [
        { component: Bookmark, color: '#888', label: 'Not saved' },
        { component: Bookmark, color: '#FFD700', label: 'Saved ✓' },
      ],
    },
  },
  {
    id: 'favourite',
    icon: Heart,
    iconColor: '#E91E63',
    category: 'Reading',
    title: 'Favourite a Verse',
    description:
      'In landscape Read Mode, tap the ♥ (Heart) icon in the verse card header to mark it ' +
      'as a favourite. A pink filled heart means it\'s in your Favourites collection.',
    where: 'Read Mode verse card → ♥ heart icon',
    tip: 'Access all favourites via the ☰ Menu → Favourites.',
    iconDemo: {
      icons: [
        { component: Heart, color: '#888', label: 'Not saved' },
        { component: Heart, color: '#E91E63', label: 'Favourite ✓' },
      ],
    },
  },
  {
    id: 'page_mode',
    icon: LayoutTemplate,
    iconColor: '#4CAF50',
    category: 'Reading',
    title: 'Page Mode',
    description:
      'Tap the [Pg] button (an icon with three horizontal lines) in the verse-list header to enter Page Mode. ' +
      'You can configure how many verses appear per "page" to match your memorization pace. ' +
      'Swipe left/right or tap the arrow buttons to flip through pages.\n\n' +
      'Header buttons in Page Mode allow you to "Mark Page" or "Revise Page" in bulk. ' +
      'When triggered, they update to "Page Memorized" or "Page Revised" and immediately update the Verse/Pages progress tab and Stats card on the Home screen!',
    where: 'Verse list header → [Pg] button',
    tip: 'Page Mode remembers your last page position for each Surah and Juz.',
    iconDemo: {
      icons: [
        { component: LayoutTemplate, color: '#4CAF50', label: 'Page Mode' },
        { component: Check, color: '#4CAF50', label: 'Mark Page' },
        { component: RefreshCw, color: '#FF9800', label: 'Revise Page' },
      ],
    },
  },

  // ── Memorization ──────────────────────────────────────────────────────────
  {
    id: 'mark_memorized',
    icon: Check,
    iconColor: '#4CAF50',
    category: 'Memorization',
    title: 'Mark a Verse Memorized',
    description:
      'Tap the ✓ (Check) button on any verse card to mark that verse as memorized. ' +
      'The card border turns green and your progress instantly updates everywhere in the app — ' +
      'Stats, Surah list badges, and quiz eligibility.',
    where: 'Verse card → ✓ check button (bottom-right group)',
    tip: 'Use the bulk-mark button in the header to memorize a whole Surah at once.',
    iconDemo: {
      icons: [
        { component: Check, color: '#888', label: 'Unmarked' },
        { component: Check, color: '#4CAF50', label: 'Memorized ✓' },
      ],
    },
  },
  {
    id: 'mark_revised',
    icon: RefreshCw,
    iconColor: '#FF9800',
    category: 'Memorization',
    title: 'Log a Revision',
    description:
      'Tap the ↻ (Rotate/Refresh) icon on any memorized verse to log a revision for that day. ' +
      'The card gains an orange border indicating it has been revised. ' +
      'Regular revision is the key to strong retention in Hifdh.',
    where: 'Verse card → ↻ refresh icon (next to ✓)',
    iconDemo: {
      icons: [
        { component: RefreshCw, color: '#888', label: 'Not revised' },
        { component: RefreshCw, color: '#FF9800', label: 'Revised ✓' },
      ],
    },
  },
  {
    id: 'ayah_of_day',
    icon: Sun,
    iconColor: '#FFD700',
    category: 'Memorization',
    title: 'Ayah of the Day',
    description:
      'Every day a new verse is featured on the Home screen as your "Ayah of the Day". ' +
      'Use it for reflection, memorization focus, or sharing with others.',
    where: 'Home tab → Ayah of the Day card',
  },
  {
    id: 'hifdh_planner',
    icon: Calendar,
    iconColor: '#2196F3',
    category: 'Memorization',
    title: 'Hifdh Planner',
    description:
      'Set a daily verse memorization goal and track your progress on a monthly calendar. ' +
      'Days where you met your target are highlighted, giving you a visual streak.',
    where: 'Home tab → Hifdh Planner card',
    tip: 'Consistency matters more than speed. Even 1 verse/day is 365 in a year.',
  },

  // ── Progress & Review ─────────────────────────────────────────────────────
  {
    id: 'continue_reading',
    icon: Play,
    iconColor: '#4CAF50',
    category: 'Progress & Review',
    title: 'Continue Reading',
    description:
      'Resume your reading journey with a single tap. The "Continue Reading" card on the Home screen ' +
      'remembers exactly where you were—whether you were reading a specific Surah or navigating through a Juz.',
    where: 'Home tab → Quick Actions',
    tip: 'The card dynamically updates its subtitle based on your last activity, showing either the Surah name ' +
      'or the Juz number. Tap it to immediately restore your portrait session at the precise verse.',
    iconDemo: {
      icons: [
        { component: Play, color: '#4CAF50', label: 'Resume' },
        { component: BookOpen, color: '#D4AF37', label: 'Surah' },
        { component: Layers, color: '#888', label: 'Juz' },
      ],
    },
  },
  {
    id: 'quiz',
    icon: HelpCircle,
    iconColor: '#9C27B0',
    category: 'Progress & Review',
    title: 'Interactive Quiz',
    description:
      'The Quiz tab tests your retention using only the verses you have already marked ' +
      'as memorized. Two formats are available: multiple-choice and complete-the-ayah.',
    where: 'Quiz tab (brain icon)',
    tip: 'The quiz gets harder the more verses you memorize — keep marking them!',
  },
  {
    id: 'ai_quiz',
    icon: Sparkles,
    iconColor: '#9C27B0',
    category: 'Progress & Review',
    title: 'AI Recitation Mode (Quiz)',
    description:
      'In the Quiz tab, select "AI Mode" to recite verses aloud into your microphone. ' +
      'The app evaluates your recitation in real-time using advanced AI analysis.\n\n' +
      '• Auto-Marking: If you score 80% or higher, the app can automatically mark the verse as correct.\n' +
      '• Detailed Scorecard: After each recite, view a breakdown of your accuracy and transcription to identify exactly where you can improve.',
    where: 'Quiz tab → Select "AI Mode" after picking a quiz',
    tip: 'Speak clearly and minimize background noise for the best AI accuracy.',
    iconDemo: {
      icons: [
        { component: Sparkles, color: '#9C27B0', label: 'AI Mode' },
        { component: Target, color: '#F44336', label: 'Target' },
      ],
    },
  },
  {
    id: 'stats',
    icon: BarChart2,
    iconColor: '#2196F3',
    category: 'Progress & Review',
    title: 'Detailed Progress Stats',
    description:
      'The Stats tab shows a heatmap of your daily activity, Surah-by-Surah progress ' +
      'percentages, total verses memorized, longest streak, and more.',
    where: 'Stats tab (bar chart icon)',
    tip: 'Tap any Surah row in Stats to jump directly to its verse list.',
  },
  {
    id: 'streak_sharing',
    icon: RefreshCw,
    iconColor: '#FF9800',
    category: 'Progress & Review',
    title: 'Daily Streak & Sharing',
    description:
      'Track how many consecutive days you have been active with the "Fire" streak card on the Home screen. ' +
      'Your daily streak builds automatically as you engage with the Quran—whether you open the app daily, read verses in Golden Read Mode or read for at least 60 seconds, recite with AI Mode, or mark verses as memorized and revised.\n\n' +
      'Tap the streak card to open the "Share My Streak" modal. You can view your current milestone level (from "🌱 Journey Begins" all the way to "👑 Half-Year Hafidh" and "🕋 Year of Devotion") and save or share a beautiful performance card to inspire your community!',
    where: 'Home tab → Fire/Streak card',
    tip: 'Unlock higher milestone badges and flame animations as your daily streak grows longer!',
    iconDemo: {
      icons: [
        { component: RefreshCw, color: '#FF9800', label: 'Consistency' },
      ],
    },
  },
  {
    id: 'community_stats',
    icon: Users,
    iconColor: '#9C27B0',
    category: 'Progress & Review',
    title: 'Community Stats',
    description:
      'See how your Hifdh journey connects with learners worldwide. ' +
      'When enabled, anonymous global insights show collective progress across the community—including total verses memorized by all iHafidh users and global milestones.\n\n' +
      'You can check quick community highlights on the Home and Stats screens, or tap through to view the full community progress breakdown.',
    where: 'Home tab → Community Progress card · or Stats tab → Global Stats',
    tip: 'All community data is aggregated and 100% anonymous, helping motivate and inspire learners across the globe without compromising privacy.',
    iconDemo: {
      icons: [
        { component: Users, color: '#9C27B0', label: 'Global Insights' },
      ],
    },
  },
  {
    id: 'quran_time',
    icon: Calendar,
    iconColor: '#4CAF50',
    category: 'Progress & Review',
    title: 'Quran Time Activity Chart',
    description:
      'Tap the "Quran Time" card right on your Home screen to open an interactive modal displaying your reading session history. ' +
      'It breaks down your activity visually by Weekly & Monthly targets via an interactive bar chart and records your absolute best session!',
    where: 'Home tab → Quran Time card',
    tip: 'Press and hold (hover) any bar on the graph to instantly reveal a floating tooltip with the exact hours/minutes spent reading that day!',
  },
  {
    id: 'quran_divisions',
    icon: Info,
    iconColor: '#2196F3',
    category: 'Progress & Review',
    title: 'Quran Divisions Summary',
    description:
      'Monitor your memorization across the four classical stylistic divisions of the Quran:\n\n' +
      '• At-Tiwal (Longest Surahs)\n' +
      '• Al-Mi\'un (Surahs with ~100 verses)\n' +
      '• Al-Mathani (Frequently recited Surahs)\n' +
      '• Al-Mufassal (Shorter Chapters)\n\n' +
      'Each section features a dynamic ring progress bar showing your exact completion percentage.',
    where: 'Stats tab → Progress section',
    tip: 'Tap the ⓘ (Info) icon below any division to see exactly which Surahs are grouped within it and their specific order.',
    iconDemo: {
      icons: [
        { component: Info, color: '#2196F3', label: 'Division Info' },
      ],
    },
  },
  {
    id: 'revision_tab',
    icon: RotateCcw,
    iconColor: '#FF9800',
    category: 'Progress & Review',
    title: 'Revise Tab',
    description:
      'The Revise tab surfaces all your memorized Surahs that are due for revision ' +
      'based on spaced repetition. Tap any card there to jump straight into that Surah\'s verse list.',
    where: 'Revise tab (refresh/arrow icon)',
  },

  // ── Settings ──────────────────────────────────────────────────────────────
  {
    id: 'tajweed',
    icon: Type,
    iconColor: '#F44336',
    category: 'Settings',
    title: 'Color-Coded Tajweed Font',
    description:
      'In Settings → Arabic Font, select "Tajweed (KFGQPC)". ' +
      'Each tajweed rule is rendered in a distinct colour — e.g. gold for Ghunnah, red for Qalqalah, ' +
      'green for Idgham, blue for Iqlab — directly in the Arabic text.',
    where: 'Settings → Arabic Font → Tajweed',
    tip: 'The Tajweed Legend in Settings explains every colour rule.',
    iconDemo: {
      icons: [
        { component: Type, color: '#FFD700', label: 'Ghunnah' },
        { component: Type, color: '#F44336', label: 'Qalqalah' },
        { component: Type, color: '#4CAF50', label: 'Idgham' },
        { component: Type, color: '#2196F3', label: 'Iqlab' },
      ],
    },
  },
  {
    id: 'translation_lang',
    icon: SearchIcon,
    iconColor: '#D4AF37',
    category: 'Settings',
    title: 'Translation Language',
    description:
      'In Settings → Reading Settings → Translation Language, pick from 13+ languages ' +
      'including Arabic, English, Urdu, Tamil, Bengali, Bahasa, French, and more.',
    where: 'Settings → Reading Settings → Translation Language',
    tip: 'Toggle "Show Translation" and "Show Transliteration" in Settings → Display Options.',
  },
  {
    id: 'reciter',
    icon: Play,
    iconColor: '#D4AF37',
    category: 'Settings',
    title: 'Choose Your Reciter',
    description:
      'Settings → Reading Settings → Reciter lets you pick from multiple world-renowned ' +
      'reciters (Al-Afasy, Minshawi, Al-Husary, and more). Tap "Preview" to sample before choosing.',
    where: 'Settings → Reading Settings → Reciter',
  },
  {
    id: 'surah_revision_reminder',
    icon: RefreshCw,
    iconColor: '#FF9800',
    category: 'Settings',
    title: 'Surah Revision Reminder',
    description:
      'In Settings → Notifications, enable "Surah Revision Reminder" to get a daily alert at 9 PM. ' +
      'It reminds you to revise any fully memorized Surah that hasn\'t been reviewed within your set threshold (e.g., 3 days). You can tap the input box to customize the number of days.',
    where: 'Settings → Notifications → Surah Revision Reminder',
    iconDemo: {
      icons: [
        { component: RefreshCw, color: '#FF9800', label: 'Revise' },
      ],
    },
  },
  {
    id: 'page_revision_reminder',
    icon: Smartphone,
    iconColor: '#2196F3',
    category: 'Settings',
    title: 'Page Revision Reminder',
    description:
      'In Settings → Notifications, enable "Page Revision Reminder" to get smart notifications ' +
      'when your daily or weekly page revision goals are incomplete, helping you stay consistently on track with your Hifdh targets.',
    where: 'Settings → Notifications → Page Revision Reminder',
  },

  // ── Extras ────────────────────────────────────────────────────────────────
  {
    id: 'hamburger_menu',
    icon: Menu,
    iconColor: '#D4AF37',
    category: 'Extras',
    title: '☰ Quick-Access Menu',
    description:
      'Tap the ☰ (hamburger) icon in the header to open the Essentials menu. ' +
      'From there you can access Bookmarks, Favourites, Quranic Duas, Moon Phases, Qibla Finder, ' +
      'and the Islamic Fasting Calendar — all from any screen.',
    where: 'Any tab header → ☰ menu icon (top-right)',
    iconDemo: {
      icons: [
        { component: Bookmark, color: '#FFD700', label: 'Bookmarks' },
        { component: Heart, color: '#E91E63', label: 'Favourites' },
        { component: Sparkles, color: '#D4AF37', label: 'Duas' },
        { component: MapPin, color: '#dc2626', label: 'Qibla' },
      ],
    },
  },
  {
    id: 'qibla',
    icon: MapPin,
    iconColor: '#dc2626',
    category: 'Extras',
    title: 'Qibla Finder',
    description:
      'A live compass that points toward the Kaaba in Makkah from your current location. ' +
      'Uses your device\'s GPS and magnetometer.',
    where: '☰ Menu → Qibla Finder',
  },
  {
    id: 'fasting',
    icon: Calendar,
    iconColor: '#2196F3',
    category: 'Extras',
    title: 'Sunnah Fasting Calendar',
    description:
      'Track and get reminded for Sunnah fasts: Mondays & Thursdays, ' +
      'the White Days (13th, 14th, 15th of each Islamic month), Ashura, Arafah, and more. ' +
      'Enable notifications in Settings → Fasting Calendar.',
    where: '☰ Menu → Sunnah Fastings',
    tip: 'Enable fasting notifications in Settings → Fasting Calendar → Enable Fasting Notifications.',
  },
  {
    id: 'duas',
    icon: Sparkles,
    iconColor: '#D4AF37',
    category: 'Extras',
    title: 'Quranic Duas',
    description:
      'A curated collection of supplication verses directly from the Quran, ' +
      'with Arabic text, transliteration, translation, and audio recitation.',
    where: '☰ Menu → Quranic Duas',
  },
];

// ─── Category Config ────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<Category, { color: string; emoji: string; gradient: [string, string] }> = {
  'Reading':            { color: '#FFD700', emoji: '📖', gradient: ['#FFD700', '#F5A623'] },
  'Memorization':       { color: '#00E676', emoji: '🧠', gradient: ['#00E676', '#69F0AE'] },
  'Progress & Review':  { color: '#448AFF', emoji: '📊', gradient: ['#448AFF', '#82B1FF'] },
  'Settings':           { color: '#E040FB', emoji: '⚙️', gradient: ['#E040FB', '#EA80FC'] },
  'Extras':             { color: '#FF4081', emoji: '✨', gradient: ['#FF4081', '#FF80AB'] },
};

const ALL_CATEGORIES = Object.keys(CATEGORY_CONFIG) as Category[];



// ─── Component ──────────────────────────────────────────────────────────────

export default function HelpScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredFeatures = useMemo(() => {
    let list = FEATURES;
    if (selectedCategory !== 'All') {
      list = list.filter(f => f.category === selectedCategory);
    }
    const query = searchQuery.toLowerCase().trim();
    if (!query) return list;
    return list.filter(f =>
      f.title.toLowerCase().includes(query) ||
      f.description.toLowerCase().includes(query) ||
      f.category.toLowerCase().includes(query) ||
      f.tip?.toLowerCase().includes(query) ||
      f.where?.toLowerCase().includes(query)
    );
  }, [searchQuery, selectedCategory]);

  // Build flat list data: section headers + items
  const listData = useMemo(() => {
    if (selectedCategory !== 'All' || searchQuery) {
      return filteredFeatures;
    }
    const data: (Category | FeatureItem)[] = [];
    ALL_CATEGORIES.forEach(cat => {
      const items = filteredFeatures.filter(f => f.category === cat);
      if (items.length > 0) {
        data.push(cat);
        items.forEach(f => data.push(f));
      }
    });
    return data;
  }, [filteredFeatures, selectedCategory, searchQuery]);

  const renderIconInCard = (item: FeatureItem) => {
    const C = item.icon;
    const color = item.iconColor || '#D4AF37';
    if (item.isCustomIcon) {
      return <WBWIcon size={22} color={color} />;
    }
    return <C size={22} color={color} />;
  };

  const renderDemoIcon = (demo: { component: any; color: string; label: string; isCustom?: boolean }) => {
    const C = demo.component;
    return (
      <View key={demo.label} style={styles.demoIconWrap}>
        {demo.isCustom
          ? <WBWIcon size={18} color={demo.color} />
          : <C size={18} color={demo.color} />
        }
        <Text style={[styles.demoIconLabel, { color: demo.color }]} numberOfLines={1}>{demo.label}</Text>
      </View>
    );
  };

  const renderFeature = (item: FeatureItem) => {
    const catConfig = CATEGORY_CONFIG[item.category];
    const isExpanded = expandedId === item.id;
    const accentColor = item.iconColor || catConfig.color;
    return (
      <Pressable
        style={[styles.card, isExpanded && [styles.cardExpanded, { borderColor: accentColor + '55' }]]}
        onPress={() => setExpandedId(isExpanded ? null : item.id)}
        android_ripple={{ color: accentColor + '15' }}
      >
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={[styles.iconContainer, { backgroundColor: accentColor + '18', borderColor: accentColor + '35' }]}>
            {renderIconInCard(item)}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.featureTitle}>{item.title}</Text>
            <View style={styles.categoryTagRow}>
              <View style={[styles.categoryDot, { backgroundColor: catConfig.color }]} />
              <Text style={[styles.categoryTag, { color: catConfig.color }]}>
                {item.category}
              </Text>
            </View>
          </View>
          <View style={[styles.chevronCircle, isExpanded && { backgroundColor: accentColor + '20' }]}>
            <Text style={[styles.chevron, isExpanded && { color: accentColor, transform: [{ rotate: '90deg' }] }]}>›</Text>
          </View>
        </View>

        {/* Collapsed preview */}
        {!isExpanded && (
          <Text style={styles.featurePreview} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        {/* Expanded detail */}
        {isExpanded && (
          <View style={styles.expandedContent}>

            <Text style={styles.featureDescription}>{item.description}</Text>

            {/* Where to find it */}
            {item.where && (
              <View style={[styles.whereRow, { borderLeftColor: accentColor + '80' }]}>
                <SearchIcon size={13} color={accentColor} />
                <Text style={[styles.whereText, { color: accentColor }]}>{item.where}</Text>
              </View>
            )}

            {/* Icon Demo Row */}
            {item.iconDemo && (
              <View style={[styles.demoBanner, { borderColor: accentColor + '20' }]}>
                <Text style={[styles.demoLabel, { color: accentColor + '90' }]}>ICON REFERENCE</Text>
                <View style={styles.demoIconRow}>
                  {item.iconDemo.icons.map(renderDemoIcon)}
                </View>
              </View>
            )}

            {/* Tip */}
            {item.tip && (
              <View style={[styles.tipBox, { borderLeftColor: accentColor + '80' }]}>
                <Text style={styles.tipEmoji}>💡</Text>
                <Text style={[styles.tipText, { color: accentColor + 'CC' }]}>{item.tip}</Text>
              </View>
            )}
          </View>
        )}
      </Pressable>
    );
  };

  const insets = useSafeAreaInsets();
  const totalFeatures = FEATURES.length;

  // Count features per category for the hero badges
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    ALL_CATEGORIES.forEach(cat => {
      counts[cat] = FEATURES.filter(f => f.category === cat).length;
    });
    return counts;
  }, []);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" />

      {/* ── Feature List with Header ───────────────────────────────────── */}
      <FlatList
        data={listData}
        keyExtractor={(item, index) =>
          typeof item === 'string' ? `cat-${item}` : item.id
        }
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            {/* ── Hero Header ──────────────────────────────────────────── */}
            <View style={[styles.heroContainer, { paddingTop: Math.max(insets.top + 8, 20) }]}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={20} color="#FFD700" />
              </TouchableOpacity>
              <View style={styles.heroContent}>
                <Text style={styles.heroTitle}>Discover iHafidh</Text>
                <Text style={styles.heroSubtitle}>
                  Explore {totalFeatures} powerful features designed to accelerate your Quran memorization journey
                </Text>
              </View>
              {/* Category quick-count badges */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.heroBadgeScroll} contentContainerStyle={styles.heroBadgeRow}>
                {ALL_CATEGORIES.map(cat => {
                  const config = CATEGORY_CONFIG[cat];
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.heroBadge, { borderColor: config.color + '40' }]}
                      onPress={() => setSelectedCategory(cat)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.heroBadgeEmoji}>{config.emoji}</Text>
                      <Text style={[styles.heroBadgeCount, { color: config.color }]}>{categoryCounts[cat]}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* ── Search ─────────────────────────────────────────────────── */}
            <View style={styles.searchContainer}>
              <View style={styles.searchBar}>
                <SearchIcon color="#FFD700" size={16} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search features, tips, icons…"
                  placeholderTextColor="#666"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.searchClear}>
                    <Text style={{ color: '#999', fontSize: 16, fontWeight: '700' }}>×</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* ── Category Pills ─────────────────────────────────────────── */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pillRow}
              style={styles.pillContainer}
            >
              {(['All', ...ALL_CATEGORIES] as (Category | 'All')[]).map(cat => {
                const active = selectedCategory === cat;
                const config = cat !== 'All' ? CATEGORY_CONFIG[cat] : null;
                const color = config?.color || '#FFD700';
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.pill,
                      active && { backgroundColor: color + '20', borderColor: color + '80' },
                    ]}
                    onPress={() => setSelectedCategory(cat)}
                    activeOpacity={0.7}
                  >
                    {cat !== 'All' && (
                      <Text style={styles.pillEmoji}>{config?.emoji}</Text>
                    )}
                    <Text style={[styles.pillText, active && { color, fontWeight: '700' }]}>
                      {cat}
                    </Text>
                    {active && cat !== 'All' && (
                      <View style={[styles.pillCount, { backgroundColor: color + '30' }]}>
                        <Text style={[styles.pillCountText, { color }]}>{categoryCounts[cat as Category]}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        }
        renderItem={({ item }) => {
          if (typeof item === 'string') {
            const cat = item as Category;
            const config = CATEGORY_CONFIG[cat];
            const count = categoryCounts[cat];
            return (
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionLine, { backgroundColor: config.color + '30' }]} />
                <View style={[styles.sectionBadge, { backgroundColor: config.color + '15', borderColor: config.color + '35' }]}>
                  <Text style={styles.sectionEmoji}>{config.emoji}</Text>
                  <Text style={[styles.sectionHeaderText, { color: config.color }]}>
                    {cat.toUpperCase()}
                  </Text>
                  <View style={[styles.sectionCount, { backgroundColor: config.color + '25' }]}>
                    <Text style={[styles.sectionCountText, { color: config.color }]}>{count}</Text>
                  </View>
                </View>
                <View style={[styles.sectionLine, { backgroundColor: config.color + '30' }]} />
              </View>
            );
          }
          return renderFeature(item);
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={styles.emptyText}>No features match "{searchQuery}"</Text>
            <TouchableOpacity onPress={() => { setSearchQuery(''); setSelectedCategory('All'); }} style={styles.emptyResetBtn}>
              <Text style={styles.emptyReset}>Clear search</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E17',
  },

  // Hero Header
  heroContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,215,0,0.1)',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,215,0,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroContent: {
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: '#8A93A6',
    letterSpacing: 0.1,
  },
  heroBadgeScroll: {
    marginTop: 4,
  },
  heroBadgeRow: {
    gap: 10,
    paddingRight: 20,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
  },
  heroBadgeEmoji: {
    fontSize: 14,
  },
  heroBadgeCount: {
    fontSize: 15,
    fontWeight: '800',
  },

  // Search
  searchContainer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.15)',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: '#E8E8E8',
    fontSize: 14,
  },
  searchClear: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Category pills
  pillContainer: {
    height: 56,
    marginTop: 8,
    marginBottom: 4,
  },
  pillRow: {
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    gap: 6,
  },
  pillEmoji: {
    fontSize: 13,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  pillCount: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 2,
  },
  pillCountText: {
    fontSize: 10,
    fontWeight: '800',
  },

  // List
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 80,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 14,
    gap: 0,
  },
  sectionLine: {
    flex: 1,
    height: 1,
  },
  sectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginHorizontal: 10,
  },
  sectionEmoji: {
    fontSize: 13,
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  sectionCount: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  sectionCountText: {
    fontSize: 10,
    fontWeight: '800',
  },

  // Card
  card: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardExpanded: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F0F0F0',
    marginBottom: 3,
  },
  categoryTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  categoryDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  categoryTag: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  chevronCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    fontSize: 20,
    color: '#4A4F5C',
    fontWeight: '500',
    lineHeight: 24,
    transform: [{ rotate: '0deg' }],
  },
  featurePreview: {
    fontSize: 13,
    lineHeight: 19,
    color: '#6B7280',
    marginTop: 10,
    paddingLeft: 56,
  },

  // Expanded content
  expandedContent: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  featureDescription: {
    fontSize: 13.5,
    lineHeight: 22,
    color: '#B0B8C8',
  },

  // Where to find
  whereRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderLeftWidth: 3,
  },
  whereText: {
    fontSize: 12.5,
    flex: 1,
    fontWeight: '500',
  },

  // Icon demo bar
  demoBanner: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  demoLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.8,
    marginBottom: 10,
  },
  demoIconRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
  },
  demoIconWrap: {
    alignItems: 'center',
    gap: 6,
    minWidth: 44,
  },
  demoIconLabel: {
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Tip
  tipBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 10,
    padding: 12,
    gap: 8,
    borderLeftWidth: 3,
  },
  tipEmoji: {
    fontSize: 14,
    marginTop: 1,
  },
  tipText: {
    flex: 1,
    fontSize: 12.5,
    fontStyle: 'italic',
    lineHeight: 19,
  },

  // Empty state
  emptyContainer: {
    marginTop: 80,
    alignItems: 'center',
    gap: 10,
  },
  emptyEmoji: {
    fontSize: 44,
    marginBottom: 4,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 15,
    textAlign: 'center',
  },
  emptyResetBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,215,0,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.25)',
  },
  emptyReset: {
    color: '#FFD700',
    fontSize: 13,
    fontWeight: '700',
  },
});

