
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { useTheme } from '../contexts/ThemeContext';
import {
  fontWeight,
  radius,
  spacing,
  typography,
} from '../constants/tokens';
import { redeemDeal, type SpotDeal } from '../lib/api';
import PrimaryButton from './ui/PrimaryButton';

type DealCardProps = {
  deal: SpotDeal;
  spotId: string;
  accessToken: string;
};

export default function DealCard({
  deal,
  spotId,
  accessToken,
}: DealCardProps) {
  const { colors } = useTheme();

  const [redemptionCode, setRedemptionCode] = useState<string | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimer.current) {
        clearTimeout(copyTimer.current);
      }
    };
  }, []);

  const markAsCopied = () => {
    setCopied(true);

    if (copyTimer.current) {
      clearTimeout(copyTimer.current);
    }

    copyTimer.current = setTimeout(() => {
      setCopied(false);
      copyTimer.current = null;
    }, 2000);
  };

  const handleCopyCode = async () => {
    if (isRedeeming) return;

    try {
      let code = redemptionCode;

      // Redeem only once. Subsequent taps copy the existing code.
      if (!code) {
        setIsRedeeming(true);

        const result = await redeemDeal(
          deal.id,
          spotId,
          accessToken
        );

        code = result.redemption_code;
        setRedemptionCode(code);
      }

      await Clipboard.setStringAsync(code);
      markAsCopied();
    } catch (error) {
      console.error('[ParkCity] Deal redemption/copy failed:', error);

      Alert.alert(
        'Unable to redeem offer',
        error instanceof Error
          ? error.message
          : 'Please try again later.'
      );
    } finally {
      setIsRedeeming(false);
    }
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.offerContainer}>
          <Text style={[styles.offerLabel, { color: colors.textSecondary }]}>
            EXCLUSIVE OFFER
          </Text>

          <Text style={[styles.offerText, { color: colors.text }]}>
            {deal.offer_text}
          </Text>
        </View>

        <View
          style={[
            styles.discountBadge,
            { backgroundColor: colors.primary },
          ]}
        >
          <Text style={styles.discountText}>
            {deal.discount_label}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.codeBox,
          {
            borderColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <Text
          selectable={!!redemptionCode}
          style={[
            styles.codeText,
            { color: colors.text },
            !redemptionCode && { color: colors.textSecondary },
          ]}
        >
          {redemptionCode || '- - - - - -'}
        </Text>
      </View>

      <PrimaryButton
        title={copied ? 'Copied!' : 'Copy Code'}
        loading={isRedeeming}
        onPress={handleCopyCode}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },

  offerContainer: {
    flex: 1,
    gap: spacing.xs,
  },

  offerLabel: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.1,
  },

  offerText: {
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
    fontWeight: fontWeight.semibold,
  },

  discountBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },

  discountText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: fontWeight.bold,
  },

  codeBox: {
    minHeight: 52,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
  },

  codeText: {
    fontSize: typography.body,
    fontWeight: fontWeight.bold,
    letterSpacing: 2,
  },
});
