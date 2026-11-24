
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

import { useTheme } from '../contexts/ThemeContext';
import { useDialog } from '../contexts/DialogContext';
import {
  fontWeight,
  letterSpacing,
  radius,
  shadow,
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
  const { showDialog } = useDialog();

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

  // Display-only: hidden when the date is missing or unparseable.
  const validUntilLabel = useMemo(() => {
    if (!deal.valid_until) return null;

    const date = new Date(deal.valid_until);
    if (Number.isNaN(date.getTime())) return null;

    return `Valid until ${date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })}`;
  }, [deal.valid_until]);

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

      showDialog({
        type: 'error',
        title: 'Unable to redeem offer',
        message:
          error instanceof Error
            ? error.message
            : 'Please try again later.',
      });
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
          <View style={styles.offerLabelRow}>
            <Ionicons
              name="pricetag-outline"
              size={12}
              color={colors.goldDeep}
            />
            <Text style={[styles.offerLabel, { color: colors.goldDeep }]}>
              EXCLUSIVE OFFER
            </Text>
          </View>

          <Text style={[styles.offerText, { color: colors.text }]}>
            {deal.offer_text}
          </Text>

          {validUntilLabel && (
            <Text
              style={[styles.validUntil, { color: colors.textSecondary }]}
            >
              {validUntilLabel}
            </Text>
          )}
        </View>

        <View
          style={[
            styles.discountBadge,
            { backgroundColor: colors.champagneSoft },
          ]}
        >
          <Text style={[styles.discountText, { color: colors.goldDeep }]}>
            {deal.discount_label}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.codeBox,
          {
            borderColor: colors.champagne,
            backgroundColor: colors.surfaceMuted,
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
        variant="outline"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    ...shadow.sm,
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

  offerLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  offerLabel: {
    fontSize: typography.overline,
    lineHeight: typography.overlineLineHeight,
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.overline,
  },

  offerText: {
    fontSize: typography.body,
    lineHeight: 22,
    fontWeight: fontWeight.semibold,
  },

  validUntil: {
    fontSize: typography.caption,
    lineHeight: typography.captionLineHeight,
  },

  discountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },

  discountText: {
    fontSize: 12,
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
