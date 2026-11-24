
export const colors = {
  // Brand: green for primary actions and positive states
  primary: '#168653',
  primaryDeep: '#116B42',
  primarySoft: '#E7F2E9',

  // Brand: gold for identity, accents and decoration
  gold: '#D6A02E',
  goldDeep: '#8C6410',
  champagne: '#E8C879',
  champagneSoft: '#F6ECD2',

  // Surfaces and text
  background: '#FAF6EE',
  surface: '#FFFFFF',
  surfaceMuted: '#F6EFE1',
  text: '#1F1B14',
  textSecondary: '#6B6457',
  border: '#ECE4D3',
  borderStrong: '#DCCDAE',

  // Status
  success: '#168653',
  warning: '#D6A02E',
  error: '#EF4545',
  errorStrong: '#D93636',
  errorText: '#D93636',
  errorSoft: '#FDECEC',
  star: '#B8860B',

  // Shared utility colors
  white: '#FFFFFF',
  shadow: '#3B2F15',
  skeleton: '#EDE4D1',

  // Overlays and translucent surfaces
  overlay: 'rgba(31,27,20,0.45)',
  overlayBorder: 'rgba(255,255,255,0.4)',
  overlayText: 'rgba(255,255,255,0.88)',
  overlaySurface: 'rgba(255,255,255,0.19)',
  overlaySurfaceBorder: 'rgba(255,255,255,0.55)',

  // Home screen surfaces
  profileSurface: 'rgba(255,255,255,0.72)',
  profileBorder: 'rgba(255,255,255,0.9)',
  destinationSurface: '#EFE6D2',
  footerSurface: '#F3ECDD',

  // Favorite button
  favoriteBackground: '#FDECEC',
  favoriteBorder: '#F8C9C9',
};

export const darkColors: typeof colors = {
  // Brand: green for primary actions and positive states
  primary: '#168653',
  primaryDeep: '#4DB27E',
  primarySoft: '#1C3326',

  // Brand: gold for identity, accents and decoration
  gold: '#E0B04A',
  goldDeep: '#E8C879',
  champagne: '#E8C879',
  champagneSoft: '#2E2819',

  // Surfaces and text
  background: '#14120E',
  surface: '#201D17',
  surfaceMuted: '#2A261E',
  text: '#FAF6EE',
  textSecondary: '#B8AE9C',
  border: '#3A3428',
  borderStrong: '#4A4334',

  // Status
  success: '#2FA96B',
  warning: '#E0B04A',
  error: '#EF4545',
  errorStrong: '#C93838',
  errorText: '#FF8A80',
  errorSoft: '#3A1E1E',
  star: '#E0B04A',

  // Shared utility colors
  white: '#FFFFFF',
  shadow: '#000000',
  skeleton: '#3A3428',

  // Overlays and translucent surfaces
  overlay: 'rgba(20,18,14,0.65)',
  overlayBorder: 'rgba(255,255,255,0.25)',
  overlayText: 'rgba(255,255,255,0.88)',
  overlaySurface: 'rgba(255,255,255,0.12)',
  overlaySurfaceBorder: 'rgba(255,255,255,0.3)',

  // Home screen surfaces
  profileSurface: 'rgba(32,29,23,0.85)',
  profileBorder: 'rgba(255,255,255,0.15)',
  destinationSurface: '#201D17',
  footerSurface: '#201D17',

  // Favorite button
  favoriteBackground: '#3A1E1E',
  favoriteBorder: '#6B3434',
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

  display: 32,
  displayLineHeight: 38,
  title: 26,
  titleLineHeight: 32,
  headline: 19,
  headlineLineHeight: 24,
  caption: 12,
  captionLineHeight: 16,
  overline: 11,
  overlineLineHeight: 14,
};

export const letterSpacing = {
  tight: -0.5,
  snug: -0.2,
  normal: 0,
  wide: 0.3,
  overline: 1.2,
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
  xl: 20,
  xxl: 28,
  pill: 999,
};

export const size = {
  buttonHeight: 48,
  buttonHeightLarge: 52,
  inputHeight: 48,
  iconSmall: 16,
  iconMedium: 20,
  iconLarge: 24,
  tabBarHeight: 58,
};

export const shadow = {
  sm: {
    shadowColor: colors.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  md: {
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  lg: {
    shadowColor: colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
};
