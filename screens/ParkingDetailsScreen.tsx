
import {
  Alert,
  Linking,
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';

import type { RootStackParamList } from '../App';
import VerificationBadge from '../components/VerificationBadge';
import ToastMessage from '../components/ui/ToastMessage';
import {
  logNavigation,
  getSavedSpots,
  getParkingHistory,
  toggleSavedSpot,
  checkInToSpot,
  checkOutFromSpot,
} from '../lib/api';
import { supabase } from '../lib/supabase';
import {
  colors,
  fontWeight,
  radius,
  spacing,
  typography,
} from '../constants/tokens';

type Props = NativeStackScreenProps<
  RootStackParamList,
  'ParkingDetails'
>;

type ToastState = {
  message: string;
  type: 'success' | 'error';
} | null;

export default function ParkingDetailsScreen({
  route,
  navigation,
}: Props) {
  const { spot } = route.params;

  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeSessionSpotId, setActiveSessionSpotId] = useState<string | null>(null);
  const [isSessionStatusLoading, setIsSessionStatusLoading] = useState(true);
  const [isParkingActionLoading, setIsParkingActionLoading] =
    useState(false);

  const [toast, setToast] = useState<ToastState>(null);

  const hasValidSpotId =
    typeof spot.id === 'string' && spot.id.trim().length > 0;

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadSpotAndSessionStatus = async () => {
        if (!hasValidSpotId) {
          if (isActive) {
            setIsSaved(false);
            setSessionId(null);
            setActiveSessionSpotId(null);
            setIsSessionStatusLoading(false);
          }

          console.warn(
            'Cannot check saved status or active session: parking spot has no valid ID.',
          );
          return;
        }

        if (isActive) {
          setIsSessionStatusLoading(true);
        }

        try {
          const {
            data: { session },
            error,
          } = await supabase.auth.getSession();

          if (error) {
            throw error;
          }

          if (!session?.access_token) {
            if (isActive) {
              setIsSaved(false);
              setSessionId(null);
              setActiveSessionSpotId(null);
            }
            return;
          }

          const [savedSpots, sessionHistory] = await Promise.all([
            getSavedSpots(session.access_token),
            getParkingHistory(session.access_token),
          ]);

          const saved = savedSpots.some(
            (savedSpot) => savedSpot.id === spot.id,
          );

          const activeSession = sessionHistory.find(
            (item) => item.checked_out_at === null,
          );

          if (isActive) {
            setIsSaved(saved);
            setActiveSessionSpotId(activeSession?.spot_id ?? null);
            setSessionId(
              activeSession?.spot_id === spot.id ? activeSession.id : null,
            );
          }
        } catch (error) {
          console.error('Could not load saved status or active session:', error);
        } finally {
          if (isActive) {
            setIsSessionStatusLoading(false);
          }
        }
      };

      void loadSpotAndSessionStatus();

      return () => {
        isActive = false;
      };
    }, [spot.id, hasValidSpotId]),
  );

  const handleToggleSaved = async () => {
    if (isSaving) {
      return;
    }

    if (!hasValidSpotId || !spot.id) {
      Alert.alert(
        'Cannot save this spot',
        'This parking spot is temporarily unavailable for saving. Please try again later.',
      );
      return;
    }

    setIsSaving(true);

    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        throw error;
      }

      if (!session?.access_token) {
        Alert.alert(
          'Sign in required',
          'Please sign in to save your favourite parking spots.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Sign in',
              onPress: () =>
                navigation.navigate('EmailLogin', {
                  next: {
                    screen: 'ParkingDetails',
                    spot,
                  },
                }),
            },
          ],
        );
        return;
      }

      const action = isSaved ? 'unsave' : 'save';

      await toggleSavedSpot(
        session.access_token,
        spot.id,
        action,
      );

      setIsSaved(!isSaved);
    } catch (error) {
      console.error('Could not update saved spot:', error);

      Alert.alert(
        'Something went wrong',
        error instanceof Error
          ? error.message
          : 'Could not update your saved spots. Please try again.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleParkingAction = async () => {
    if (isParkingActionLoading) {
      return;
    }

    if (isSessionStatusLoading) {
      return;
    }

    if (activeSessionSpotId && activeSessionSpotId !== spot.id && !sessionId) {
      setToast({
        message:
          'You already have an active parking session at another spot. Check out there before checking in here.',
        type: 'error',
      });
      return;
    }

    if (!hasValidSpotId || !spot.id) {
      setToast({
        message: 'This parking spot is currently unavailable for check-in.',
        type: 'error',
      });
      return;
    }

    setIsParkingActionLoading(true);
    setToast(null);

    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        throw error;
      }

      if (!session?.access_token) {
        Alert.alert(
          'Sign in required',
          'Please sign in to start a parking session.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Sign in',
              onPress: () =>
                navigation.navigate('EmailLogin', {
                  next: {
                    screen: 'ParkingDetails',
                    spot,
                  },
                }),
            },
          ],
        );
        return;
      }

      // CHECK-OUT
      if (sessionId) {
        const completedSessionId = sessionId;

        const result = await checkOutFromSpot(
          session.access_token,
          completedSessionId,
        );

        setSessionId(null);
        setActiveSessionSpotId(null);

        const duration = result.duration_minutes;
        const cost =
          result.estimated_cost == null
            ? 'Cost unavailable'
            : `Estimated cost: ₹${result.estimated_cost.toFixed(2)}`;

        setToast({
          message: `Parking session ended. Duration: ${duration} minutes. ${cost}`,
          type: 'success',
        });

        navigation.navigate('Satisfaction', {
          spotId: spot.id,
          sessionId: completedSessionId,
        });

        return;
      }

      // CHECK-IN
      const permission =
        await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        setToast({
          message:
            'Location permission is required to check in. Please enable location access in your device settings.',
          type: 'error',
        });
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const result = await checkInToSpot(
        session.access_token,
        spot.id,
        location.coords.latitude,
        location.coords.longitude,
      );

      // Navigate to the reminder screen after successful check-in.
      navigation.replace('SetReminder', {
        sessionId: result.session_id,
        spotName: spot.name,
        accessToken: session.access_token,
      });
    } catch (error) {
      console.error('Parking session action failed:', error);

      setToast({
        message:
          error instanceof Error
            ? error.message
            : 'Something went wrong. Please try again.',
        type: 'error',
      });
    } finally {
      setIsParkingActionLoading(false);
    }
  };

  const handleNavigate = async () => {
    const url =
      `https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}`;

    if (spot.id) {
      void logNavigation(spot.id).catch((error) => {
        console.error('Could not log navigation:', error);
      });
    }

    try {
      await Linking.openURL(url);
    } catch (error) {
      console.error('Could not open Google Maps:', error);
    }
  };

  const handleClaim = async () => {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        Alert.alert(
          'Something went wrong',
          'Could not verify your sign-in status. Please try again.',
        );
        return;
      }

      if (!session?.user) {
        navigation.navigate('EmailLogin', {
          next: {
            screen: 'ClaimSpot',
            spot,
          },
        });
        return;
      }

      navigation.navigate('ClaimSpot', { spot });
    } catch (error) {
      console.error('Could not check sign-in status:', error);

      Alert.alert(
        'Something went wrong',
        'Could not verify your sign-in status. Please try again.',
      );
    }
  };

  const verificationTier =
    spot.verification_tier ??
    (spot.source === 'google_raw' ? 'google_raw' : 'unverified');

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>← Back to parking</Text>
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.eyebrow}>PARKING DETAILS</Text>

          <View style={styles.nameRow}>
            <Text style={styles.name}>{spot.name}</Text>

            <Pressable
              onPress={handleToggleSaved}
              disabled={isSaving || !hasValidSpotId}
              style={[
                styles.favoriteButton,
                isSaved && styles.favoriteButtonActive,
                (isSaving || !hasValidSpotId) &&
                  styles.favoriteButtonDisabled,
              ]}
              accessibilityRole="button"
              accessibilityState={{
                selected: isSaved,
                disabled: isSaving || !hasValidSpotId,
              }}
              accessibilityLabel={
                !hasValidSpotId
                  ? 'This parking spot cannot currently be saved'
                  : isSaved
                    ? 'Remove from saved spots'
                    : 'Save this spot'
              }
            >
              <Text
                style={[
                  styles.favoriteIcon,
                  isSaved && styles.favoriteIconActive,
                ]}
              >
                {isSaved ? '♥' : '♡'}
              </Text>
            </Pressable>
          </View>

          <VerificationBadge tier={verificationTier} />

          <View style={styles.divider} />

          <Text style={styles.label}>Hourly price</Text>
          <Text style={styles.price}>
            {spot.price_per_hour == null
              ? 'Price unavailable'
              : `₹${spot.price_per_hour}/hr`}
          </Text>

          {toast && (
            <View style={styles.toastContainer}>
              <ToastMessage
                message={toast.message}
                type={toast.type}
              />
            </View>
          )}

          <Pressable
            style={[
              styles.parkingButton,
              sessionId && styles.checkoutButton,
              (
                isParkingActionLoading ||
                isSessionStatusLoading ||
                !hasValidSpotId ||
                (
                  activeSessionSpotId !== null &&
                  activeSessionSpotId !== spot.id &&
                  !sessionId
                )
              ) && styles.actionButtonDisabled,
            ]}
            onPress={handleParkingAction}
            disabled={
              isParkingActionLoading ||
              isSessionStatusLoading ||
              !hasValidSpotId ||
              (
                activeSessionSpotId !== null &&
                activeSessionSpotId !== spot.id &&
                !sessionId
              )
            }
            accessibilityRole="button"
            accessibilityLabel={
              isSessionStatusLoading
                ? 'Checking session...'
                : sessionId
                  ? "I've left"
                  : activeSessionSpotId && activeSessionSpotId !== spot.id
                    ? 'Active session elsewhere'
                    : "I've parked here"
            }
          >
            <Text style={styles.parkingButtonText}>
              {isParkingActionLoading
                ? 'Please wait...'
                : isSessionStatusLoading
                  ? 'Checking session...'
                  : sessionId
                    ? "I've left"
                    : activeSessionSpotId && activeSessionSpotId !== spot.id
                      ? 'Active session elsewhere'
                      : "I've parked here"}
            </Text>
          </Pressable>

          <Pressable
            style={styles.navigateButton}
            onPress={handleNavigate}
            accessibilityRole="button"
            accessibilityLabel="Get Directions"
          >
            <Text style={styles.navigateButtonText}>
              Get Directions
            </Text>
          </Pressable>

          <Pressable
            style={styles.claimButton}
            onPress={handleClaim}
            accessibilityRole="button"
            accessibilityLabel="Claim this spot"
          >
            <Text style={styles.claimButtonText}>
              Claim this spot
            </Text>
          </Pressable>

          <Pressable
            style={styles.reportButton}
            onPress={() => navigation.navigate('ReportIssue', { spot })}
            accessibilityRole="button"
            accessibilityLabel="Report an issue with this parking spot"
          >
            <Text style={styles.reportButtonText}>
              Report an Issue
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
    paddingTop: spacing.xl * 2,
    paddingBottom: spacing.xl * 2,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  backText: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: fontWeight.medium,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  eyebrow: {
    color: colors.textSecondary,
    fontSize: typography.small,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: {
    flex: 1,
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: fontWeight.bold,
  },
  favoriteButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteButtonActive: {
    backgroundColor: colors.favoriteBackground,
    borderColor: colors.favoriteBorder,
  },
  favoriteButtonDisabled: {
    opacity: 0.6,
  },
  favoriteIcon: {
    fontSize: 27,
    color: colors.textSecondary,
  },
  favoriteIconActive: {
    color: colors.error,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },
  label: {
    color: colors.textSecondary,
    fontSize: typography.small,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  price: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: fontWeight.semibold,
  },
  toastContainer: {
    marginTop: spacing.lg,
  },
  parkingButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  checkoutButton: {
    backgroundColor: colors.error,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  parkingButtonText: {
    color: colors.background,
    fontSize: typography.body,
    fontWeight: fontWeight.semibold,
  },
  navigateButton: {
    backgroundColor: colors.text,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  navigateButtonText: {
    color: colors.background,
    fontSize: typography.body,
    fontWeight: fontWeight.semibold,
  },
  claimButton: {
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  claimButtonText: {
    color: colors.primary,
    fontSize: typography.body,
    fontWeight: fontWeight.semibold,
  },
  reportButton: {
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  reportButtonText: {
    color: colors.error,
    fontSize: typography.small,
    fontWeight: fontWeight.semibold,
  },
});
