import { StyleSheet } from 'react-native';

export const GRADIENTS: Record<string, [string, string]> = {
  default: ['#0d4d4d', '#1a7a5e'],
  gold: ['#8b6914', '#6b5410'],
  purple: ['#4c1d95', '#312e81'],
  green: ['#065f46', '#0f766e'],
};

export const ACCENTS = {
  gold: '#d4af37',
  silver: '#c0c0c0',
  bronze: '#cd7f32',
  white: '#ffffff',
};

export const TIMINGS = {
  enter: 300,
  exit: 250,
  backdropFade: 200,
  iconPulse: 1000,
  ornamentFade: 400,
};

export default StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 20,
    overflow: 'hidden',
    paddingBottom: 18,
  },
  contentInner: {
    paddingHorizontal: 18,
    paddingTop: 32,
    paddingBottom: 12,
  },
  iconWrap: {
    position: 'absolute',
    top: -36,
    left: '50%',
    marginLeft: -36,
    width: 72,
    height: 72,
    borderRadius: 72 / 2,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.9,
    textAlign: 'center',
    marginTop: 6,
  },
  bodyText: { fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: 10 },
  badgesWrap: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 8 },
  badgePill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, marginHorizontal: 4 },
  buttonsWrap: { marginTop: 16, paddingHorizontal: 18, gap: 12 },
  actionFull: { width: '100%', borderRadius: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  actionPrimaryText: { fontWeight: '700' },
  actionSecondaryText: { fontWeight: '600' },
  arabicText: { fontSize: 18, textAlign: 'center', lineHeight: 30, marginTop: 8 },
  arabicTranslation: { fontSize: 13, textAlign: 'center', color: '#dfe7e7', marginTop: 4 },
  dividerWrap: { alignItems: 'center', marginTop: 12 },
  ornamentTop: { width: '100%', height: 40 },
});
