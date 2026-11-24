
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { VerificationTier } from '../types/parking';
import { useTheme } from '../contexts/ThemeContext';
import {
  darkColors,
  colors as lightColors,
  fontWeight,
  radius,
} from '../constants/tokens';

type BadgeVariant = 'default' | 'onImage';

type Props = {
  tier: VerificationTier;
  variant?: BadgeVariant;
};

type IoniconName = keyof typeof Ionicons.glyphMap;

type Tone = 'verified' | 'community' | 'unconfirmed';

const badgeConfig: Record<
  VerificationTier,
  { label: string; icon: IoniconName | null; tone: Tone }
> = {
  field_verified: {
    label: 'Field verified',
    icon: 'checkmark-circle',
    tone: 'verified',
  },
  owner_verified: {
    label: 'Owner confirmed',
    icon: 'shield-checkmark',
    tone: 'verified',
  },
  crowd_verified: {
    label: 'Community reported',
    icon: 'people',
    tone: 'community',
  },
  google_raw: {
    label: 'Google · Unconfirmed',
    icon: null,
    tone: 'unconfirmed',
  },
  unverified: {
    label: 'Google · Unconfirmed',
    icon: null,
    tone: 'unconfirmed',
  },
};

// Frosted pill for use on top of photos. Fixed colours so it reads
// the same on any image, in light and dark mode.
const ON_IMAGE_BACKGROUND = 'rgba(20,18,14,0.62)';
const ON_IMAGE_BORDER = 'rgba(255,255,255,0.28)';
const ON_IMAGE_ICON: Record<Tone, string> = {
  verified: darkColors.primaryDeep,
  community: lightColors.champagne,
  unconfirmed: 'rgba(255,255,255,0.7)',
};

export default function VerificationBadge({
  tier,
  variant = 'default',
}: Props) {
  const { colors } = useTheme();
  const config = badgeConfig[tier] ?? badgeConfig.unverified;

  const toneColors: Record<
    Tone,
    { background: string; text: string; icon: string }
  > = {
    verified: {
      background: colors.primarySoft,
      text: colors.primaryDeep,
      icon: colors.primaryDeep,
    },
    community: {
      background: colors.champagneSoft,
      text: colors.goldDeep,
      icon: colors.goldDeep,
    },
    unconfirmed: {
      background: colors.surfaceMuted,
      text: colors.textSecondary,
      icon: colors.textSecondary,
    },
  };

  const isOnImage = variant === 'onImage';
  const palette = isOnImage
    ? {
        background: ON_IMAGE_BACKGROUND,
        text: lightColors.white,
        icon: ON_IMAGE_ICON[config.tone],
      }
    : toneColors[config.tone];

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: palette.background },
        isOnImage && styles.badgeOnImage,
      ]}
    >
      {config.icon ? (
        <Ionicons name={config.icon} size={12} color={palette.icon} />
      ) : (
        <View style={[styles.dot, { backgroundColor: palette.icon }]} />
      )}

      <Text
        style={[styles.label, { color: palette.text }]}
        numberOfLines={1}
      >
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  badgeOnImage: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ON_IMAGE_BORDER,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.2,
  },
});
