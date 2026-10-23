
export const colors = {
  primary: '#1F6B4F',
  background: '#FAF7EF',
  surface: '#FFFFFF',
  text: '#17201C',
  textSecondary: '#66736C',
  border: '#E3E8E5',
  success: '#2E9B68',
  warning: '#D99A2B',
  error: '#D64545',

  // Shared utility colors
  white: '#FFFFFF',
  shadow: '#000000',
  skeleton: '#D9E0D7',

  // Overlays and translucent surfaces
  overlay: 'rgba(23,32,28,0.45)',
  overlayBorder: 'rgba(255,255,255,0.4)',
  overlayText: 'rgba(255,255,255,0.88)',
  overlaySurface: 'rgba(255,255,255,0.19)',
  overlaySurfaceBorder: 'rgba(255,255,255,0.55)',

  // Home screen surfaces
  profileSurface: 'rgba(255,255,255,0.7)',
  profileBorder: 'rgba(255,255,255,0.9)',
  destinationSurface: '#D9E0D7',
  footerSurface: '#E5E9D9',

  // Favorite button
  favoriteBackground: '#FDE8E8',
  favoriteBorder: '#F5C2C2',
};

export const darkColors = {
  primary: '#1F6B4F',
  background: '#17201C',
  surface: '#222D27',
  text: '#FAF7EF',
  textSecondary: '#AAB6AE',
  border: '#39463E',
  success: '#2E9B68',
  warning: '#D99A2B',
  error: '#D64545',

  // Shared utility colors
  white: '#FFFFFF',
  shadow: '#000000',
  skeleton: '#39463E',

  // Overlays and translucent surfaces
  overlay: 'rgba(23,32,28,0.65)',
  overlayBorder: 'rgba(255,255,255,0.25)',
  overlayText: 'rgba(255,255,255,0.88)',
  overlaySurface: 'rgba(255,255,255,0.12)',
  overlaySurfaceBorder: 'rgba(255,255,255,0.3)',

  // Home screen surfaces
  profileSurface: 'rgba(34,45,39,0.85)',
  profileBorder: 'rgba(255,255,255,0.15)',
  destinationSurface: '#222D27',
  footerSurface: '#222D27',

  // Favorite button
  favoriteBackground: '#492B2B',
  favoriteBorder: '#754141',
};

export const verificationColors = {
  fieldVerified: {
    background: '#DCFCE7',
    text: '#166534',
    dot: '#16A34A',
  },
  ownerVerified: {
    background: '#DBEAFE',
    text: '#1D4ED8',
    dot: '#2563EB',
  },
  crowdVerified: {
    background: '#FEF3C7',
    text: '#92400E',
    dot: '#D97706',
  },
  unverified: {
    background: '#F3F4F6',
    text: '#4B5563',
    dot: '#9CA3AF',
  },
};

export const typography = {
  body: 16,
  small: 14,
  heading: 28,
  smallLineHeight: 20,
  bodyLineHeight: 24,
  headingLineHeight: 34,
};

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
};

export const size = {
  buttonHeight: 48,
  inputHeight: 48,
  iconSmall: 16,
  iconMedium: 20,
  iconLarge: 24,
};

export const shadow = {
  sm: {
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  md: {
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
};
