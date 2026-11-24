
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../App';
import { checkOutFromSpot } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { useDialog } from '../contexts/DialogContext';
import {
  colors as lightColors,
  fontWeight,
  letterSpacing,
  radius,
  shadow,
  spacing,
  typography,
} from '../constants/tokens';
import ElapsedRing from '../components/ui/ElapsedRing';
import PrimaryButton from '../components/ui/PrimaryButton';

type Props = NativeStackScreenProps<
  RootStackParamList,
  'ActiveParking'
>;

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function ActiveParkingScreen({
  route,
  navigation,
}: Props) {
  const { session } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { showDialog } = useDialog();

  const [checkingOut, setCheckingOut] = useState(false);
  const [actionBarHeight, setActionBarHeight] = useState(80);

  const ringSize = width < 360 ? 176 : 200;

  const handleCheckout = () => {
    showDialog({
      type: 'confirmation',
      title: 'End parking session?',
      message: 'Are you sure you have left this parking spot?',
      actions: [
        {
          label: 'Cancel',
          variant: 'secondary',
        },
        {
          label: 'Yes, I have left',
          variant: 'destructive',
          onPress: confirmCheckout,
        },
      ],
    });
  };

  const confirmCheckout = async () => {
    if (checkingOut) return;

    setCheckingOut(true);

    try {
      const {
        data: { session: authSession },
        error,
      } = await supabase.auth.getSession();

      if (error) throw error;

      if (!authSession?.access_token) {
        throw new Error('Please sign in again to end your parking session.');
      }

      const result = await checkOutFromSpot(
        authSession.access_token,
        session.id,
      );

      const cost =
        result.estimated_cost == null
          ? 'Cost unavailable'
          : `Estimated cost: ₹${result.estimated_cost.toFixed(2)}`;

      showDialog({
        type: 'success',
        title: 'Parking session completed',
        message: `Duration: ${result.duration_minutes} minutes\n${cost}`,
        actions: [
          {
            label: 'Done',
            onPress: () => {
              // Replace so the ended session's screen is removed from the
              // stack; leaving Satisfaction then returns to where the user
              // started instead of this screen.
              navigation.replace('Satisfaction', {
                spotId: session.spot_id,
                sessionId: session.id,
              });
            },
          },
        ],
        dismissible: false,
      });
    } catch (error) {
      showDialog({
        type: 'error',
        title: 'Checkout failed',
        message:
          error instanceof Error
            ? error.message
            : 'Could not end your parking session. Please try again.',
      });
    } finally {
      setCheckingOut(false);
    }
  };

  const hasValidCheckIn = !Number.isNaN(
    new Date(session.checked_in_at).getTime(),
  );

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: insets.top + spacing.sm,
            paddingBottom: actionBarHeight + spacing.lg,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.backButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Back to Home"
          hitSlop={6}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.eyebrow}>YOUR PARKING</Text>

          <Text style={styles.title}>Active Session</Text>

          <Text style={styles.subtitle}>
            Your parking session is currently active.
          </Text>
        </View>

        {/* Location */}
        <View style={styles.locationCard}>
          <View style={styles.locationIcon}>
            <Ionicons name="car" size={20} color={colors.primary} />
          </View>

          <View style={styles.locationText}>
            <View style={styles.statusChip}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Currently parked</Text>
            </View>

            <Text style={styles.spotName}>
              {session.parking_spots?.name ?? 'Parking location'}
            </Text>

            <Text style={styles.address}>
              {session.parking_spots?.address ?? 'Address unavailable'}
            </Text>
          </View>
        </View>

        {/* Duration */}
        <View style={styles.durationCard}>
          <ElapsedRing
            startedAt={session.checked_in_at}
            size={ringSize}
          />

          {hasValidCheckIn && (
            <View style={styles.startedBlock}>
              <Text style={styles.startedLabel}>Session started</Text>
              <Text style={styles.startedValue}>
                {formatTime(session.checked_in_at)} ·{' '}
                {formatDate(session.checked_in_at)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.notice}>
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={colors.textSecondary}
          />
          <Text style={styles.noticeText}>
            Remember to check out when you leave. Your parking duration and
            estimated cost will be calculated after checkout.
          </Text>
        </View>
      </ScrollView>

      {/* Sticky checkout */}
      <View
        style={[
          styles.actionBar,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
        onLayout={(event) =>
          setActionBarHeight(event.nativeEvent.layout.height)
        }
      >
        <PrimaryButton
          title="I've left this parking spot"
          variant="destructive"
          onPress={handleCheckout}
          loading={checkingOut}
          disabled={checkingOut}
        />
      </View>
    </View>
  );
}

const createStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      flex: 1,
    },
    container: {
      paddingHorizontal: spacing.lg,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
      ...shadow.sm,
    },
    backButtonPressed: {
      opacity: 0.75,
    },
    header: {
      marginBottom: spacing.lg,
    },
    eyebrow: {
      color: colors.goldDeep,
      fontSize: typography.overline,
      lineHeight: typography.overlineLineHeight,
      fontWeight: fontWeight.bold,
      letterSpacing: letterSpacing.overline,
      marginBottom: spacing.xs,
    },
    title: {
      color: colors.text,
      fontSize: typography.title,
      lineHeight: typography.titleLineHeight,
      fontWeight: fontWeight.bold,
      letterSpacing: letterSpacing.tight,
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: typography.small,
      lineHeight: typography.smallLineHeight,
      marginTop: spacing.xs,
    },

    // Location card
    locationCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      padding: spacing.md,
      borderRadius: radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      ...shadow.sm,
    },
    locationIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    locationText: {
      flex: 1,
      minWidth: 0,
    },
    statusChip: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: radius.pill,
      backgroundColor: colors.primarySoft,
      marginBottom: spacing.sm,
    },
    statusDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
    statusText: {
      color: colors.primaryDeep,
      fontSize: typography.caption,
      fontWeight: fontWeight.semibold,
    },
    spotName: {
      color: colors.text,
      fontSize: 19,
      lineHeight: 24,
      fontWeight: fontWeight.bold,
      letterSpacing: letterSpacing.snug,
    },
    address: {
      color: colors.textSecondary,
      fontSize: 13.5,
      lineHeight: 20,
      marginTop: 3,
    },

    // Duration card
    durationCard: {
      marginTop: spacing.md,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.md,
      borderRadius: radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
    },
    startedBlock: {
      alignItems: 'center',
      marginTop: spacing.md,
      gap: 2,
    },
    startedLabel: {
      color: colors.textSecondary,
      fontSize: typography.caption,
      lineHeight: typography.captionLineHeight,
    },
    startedValue: {
      color: colors.text,
      fontSize: typography.small,
      lineHeight: typography.smallLineHeight,
      fontWeight: fontWeight.semibold,
    },

    // Notice
    notice: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      marginTop: spacing.md,
      padding: 12,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceMuted,
    },
    noticeText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 12.5,
      lineHeight: 18,
    },

    // Sticky action bar
    actionBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: spacing.md,
      paddingTop: 12,
      backgroundColor: colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      ...shadow.md,
      shadowOffset: { width: 0, height: -2 },
    },
  });
