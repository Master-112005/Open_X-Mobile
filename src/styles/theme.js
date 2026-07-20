export const colors = {
  background: '#03050A',
  backgroundAlt: '#070A12',
  surface: 'rgba(18, 21, 30, 0.86)',
  surfaceElevated: 'rgba(28, 31, 42, 0.94)',
  surfaceSoft: 'rgba(14, 17, 25, 0.82)',
  content: 'rgba(15, 18, 27, 0.96)',
  contentElevated: 'rgba(24, 27, 38, 0.98)',
  glass: 'rgba(255, 255, 255, 0.115)',
  glassStrong: 'rgba(255, 255, 255, 0.17)',
  glassSubtle: 'rgba(255, 255, 255, 0.075)',
  glassFrosted: 'rgba(255, 255, 255, 0.20)',
  border: 'rgba(255, 255, 255, 0.15)',
  borderBright: 'rgba(255, 255, 255, 0.34)',
  primary: '#FFFFFF',
  primaryPressed: '#E0E0E0',
  primaryMuted: 'rgba(255, 255, 255, 0.12)',
  accent: '#FFFFFF',
  accentMuted: 'rgba(255, 255, 255, 0.1)',
  blue: '#62A8FF',
  cyan: '#7BE7FF',
  violet: '#A98BFF',
  text: '#F7F9FF',
  textSecondary: 'rgba(247, 249, 255, 0.72)',
  textMuted: 'rgba(247, 249, 255, 0.46)',
  assistantBubble: 'rgba(24, 24, 24, 0.82)',
  userBubble: 'rgba(255, 255, 255, 0.14)',
  success: '#46D991',
  warning: '#F6B94A',
  danger: '#FF6675',
  white: '#FFFFFF',
  overlay: 'rgba(3, 6, 14, 0.68)',
};

export const gradients = {
  appBackground: ['#070A12', '#02040A', '#090D16'],
  appBackgroundVeil: ['rgba(98, 168, 255, 0.16)', 'rgba(123, 231, 255, 0.04)', 'rgba(169, 139, 255, 0.08)'],
  glass: ['rgba(255, 255, 255, 0.21)', 'rgba(255, 255, 255, 0.075)'],
  glassSoft: ['rgba(255, 255, 255, 0.12)', 'rgba(255, 255, 255, 0.035)'],
  glassDark: ['rgba(34, 39, 54, 0.94)', 'rgba(14, 17, 25, 0.86)'],
  primary: ['rgba(255, 255, 255, 0.96)', 'rgba(229, 237, 250, 0.86)'],
  primarySoft: ['rgba(255, 255, 255, 0.20)', 'rgba(255, 255, 255, 0.075)'],
  dangerSoft: ['rgba(255, 102, 117, 0.18)', 'rgba(255, 102, 117, 0.08)'],
  successSoft: ['rgba(70, 217, 145, 0.18)', 'rgba(70, 217, 145, 0.08)'],
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  xs: 8,
  sm: 12,
  md: 18,
  lg: 26,
  xl: 32,
  round: 999,
};

export const shadows = {
  card: {
    elevation: 7,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.26,
    shadowRadius: 26,
  },
  glow: {
    elevation: 9,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
  },
  floating: {
    elevation: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.34,
    shadowRadius: 34,
  },
};

export const glassSurface = {
  ...shadows.card,
  backgroundColor: colors.glass,
  borderColor: colors.border,
  borderWidth: 1,
};
