
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../App';
import { checkOutFromSpot } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { spacing, fontWeight } from '../constants/tokens';

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

  const [checkingOut, setCheckingOut] = useState(false);

  const handleCheckout = () => {
    Alert.alert(
      'End parking session?',
      'Are you sure you have left this parking spot?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Yes, I have left',
          style: 'destructive',
          onPress: confirmCheckout,
        },
      ],
    );
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

      Alert.alert(
        'Parking session completed',
        `Duration: ${result.duration_minutes} minutes\n${cost}`,
        [
          {
            text: 'Done',
            onPress: () => navigation.goBack(),
          },
        ],
      );
    } catch (error) {
      Alert.alert(
        'Checkout failed',
        error instanceof Error
          ? error.message
          : 'Could not end your parking session. Please try again.',
      );
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Pressable
        onPress={() => navigation.goBack()}
        style={styles.backButton}
      >
        <Text style={[styles.backText, { color: colors.primary }]}>
          ← Back to Home
        </Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>
          YOUR PARKING
        </Text>

        <Text style={[styles.title, { color: colors.text }]}>
          Active Session
        </Text>

        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Your parking session is currently active.
        </Text>
      </View>

      <View
        style={[
          styles.statusCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.statusRow}>
          <View style={styles.statusIndicator} />
          <Text style={styles.statusText}>CURRENTLY PARKED</Text>
        </View>

        <Text style={[styles.spotName, { color: colors.text }]}>
          {session.parking_spots?.name ?? 'Parking location'}
        </Text>

        <Text style={[styles.address, { color: colors.textSecondary }]}>
          {session.parking_spots?.address ?? 'Address unavailable'}
        </Text>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Session details
      </Text>

      <View
        style={[
          styles.detailsCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
            Date
          </Text>
          <Text style={[styles.detailValue, { color: colors.text }]}>
            {formatDate(session.checked_in_at)}
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
            Check-in time
          </Text>
          <Text style={[styles.detailValue, { color: colors.text }]}>
            {formatTime(session.checked_in_at)}
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
            Status
          </Text>
          <Text style={styles.activeValue}>Active</Text>
        </View>
      </View>

      <View
        style={[
          styles.notice,
          { backgroundColor: colors.primary + '12' },
        ]}
      >
        <Text style={[styles.noticeText, { color: colors.text }]}>
          Remember to check out when you leave. Your parking duration and
          estimated cost will be calculated after checkout.
        </Text>
      </View>

      <Pressable
        onPress={handleCheckout}
        disabled={checkingOut}
        style={({ pressed }) => [
          styles.checkoutButton,
          { backgroundColor: colors.error },
          pressed && !checkingOut && styles.buttonPressed,
          checkingOut && styles.buttonDisabled,
        ]}
      >
        {checkingOut ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.checkoutText}>
            I've left this parking spot
          </Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: 60,
    paddingBottom: spacing.xl,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: spacing.xl,
  },
  backText: {
    fontSize: 14,
    fontWeight: fontWeight.semibold,
  },
  header: {
    marginBottom: spacing.xl,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: fontWeight.bold,
  },
  subtitle: {
    fontSize: 14,
    marginTop: spacing.xs,
  },
  statusCard: {
    padding: spacing.lg,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: spacing.xl,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.lg,
  },
  statusIndicator: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#27965C',
  },
  statusText: {
    color: '#27965C',
    fontSize: 11,
    fontWeight: fontWeight.bold,
    letterSpacing: 1,
  },
  spotName: {
    fontSize: 21,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.xs,
  },
  address: {
    fontSize: 14,
    lineHeight: 21,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.md,
  },
  detailsCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  detailLabel: {
    fontSize: 13,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: fontWeight.semibold,
  },
  activeValue: {
    color: '#27965C',
    fontSize: 14,
    fontWeight: fontWeight.semibold,
  },
  divider: {
    height: 1,
  },
  notice: {
    padding: spacing.md,
    borderRadius: 13,
    marginBottom: spacing.xl,
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 20,
  },
  checkoutButton: {
    padding: spacing.lg,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
  checkoutText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: fontWeight.semibold,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
});
