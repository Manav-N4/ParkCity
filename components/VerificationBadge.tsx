
import { StyleSheet, Text, View } from 'react-native';
import type { VerificationTier } from '../types/parking';
import { verificationColors } from '../constants/tokens';

type Props = {
  tier: VerificationTier;
};

const badgeConfig: Record<
  VerificationTier,
  {
    label: string;
    background: string;
    text: string;
    dot: string;
  }
> = {
  field_verified: {
    label: 'FIELD VERIFIED',
    ...verificationColors.fieldVerified,
  },
  owner_verified: {
    label: 'OWNER CONFIRMED',
    ...verificationColors.ownerVerified,
  },
  crowd_verified: {
    label: 'COMMUNITY REPORTED',
    ...verificationColors.crowdVerified,
  },
  google_raw: {
    label: 'GOOGLE · UNCONFIRMED',
    ...verificationColors.unverified,
  },
  unverified: {
    label: 'GOOGLE · UNCONFIRMED',
    ...verificationColors.unverified,
  },
};

export default function VerificationBadge({ tier }: Props) {
  const config = badgeConfig[tier] ?? badgeConfig.unverified;

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: config.background },
      ]}
    >
      <View
        style={[styles.dot, { backgroundColor: config.dot }]}
      />

      <Text style={[styles.label, { color: config.text }]}>
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
    gap: 6,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
});
