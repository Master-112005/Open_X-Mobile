export const colors = {
  background: '#000000',
  backgroundAlt: '#050505',
  surface: 'rgba(14, 14, 14, 0.84)',
  surfaceElevated: 'rgba(24, 24, 24, 0.92)',
  surfaceSoft: 'rgba(10, 10, 10, 0.78)',
  glass: 'rgba(22, 22, 22, 0.74)',
  glassStrong: 'rgba(30, 30, 30, 0.9)',
  glassSubtle: 'rgba(255, 255, 255, 0.07)',
  border: 'rgba(255, 255, 255, 0.16)',
  borderBright: 'rgba(255, 255, 255, 0.32)',
  primary: '#FFFFFF',
  primaryPressed: '#E0E0E0',
  primaryMuted: 'rgba(255, 255, 255, 0.12)',
  accent: '#FFFFFF',
  accentMuted: 'rgba(255, 255, 255, 0.1)',
  text: '#F7F9FF',
  textSecondary: 'rgba(247, 249, 255, 0.72)',
  textMuted: 'rgba(247, 249, 255, 0.46)',
  assistantBubble: 'rgba(24, 24, 24, 0.82)',
  userBubble: 'rgba(255, 255, 255, 0.14)',
  success: '#46D991',
  warning: '#F6B94A',
  danger: '#FF6675',
  white: '#FFFFFF',
  overlay: 'rgba(3, 6, 14, 0.62)',
};

export const gradients = {
  appBackground: ['#000000', '#050505', '#000000'],
  glass: ['rgba(255, 255, 255, 0.16)', 'rgba(255, 255, 255, 0.055)'],
  glassSoft: ['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.035)'],
  primary: ['rgba(255, 255, 255, 0.24)', 'rgba(255, 255, 255, 0.1)'],
  primarySoft: ['rgba(255, 255, 255, 0.16)', 'rgba(255, 255, 255, 0.06)'],
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
  sm: 10,
  md: 16,
  lg: 22,
  round: 999,
};

export const shadows = {
  card: {
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
  },
  glow: {
    elevation: 9,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
  },
};

export const glassSurface = {
  ...shadows.card,
  backgroundColor: colors.glass,
  borderColor: colors.border,
  borderWidth: 1,
};
