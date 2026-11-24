
import {
  Linking,
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
} from 'react-native';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { setStatusBarStyle } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../App';
import VerificationBadge from '../components/VerificationBadge';
import ToastMessage from '../components/ui/ToastMessage';
import DealCard from '../components/DealCard';
import ListRow from '../components/ui/ListRow';
import PrimaryButton from '../components/ui/PrimaryButton';
import {
  logNavigation,
  getSavedSpots,
  getParkingHistory,
  toggleSavedSpot,
  checkInToSpot,
  checkOutFromSpot,
  getSpotDeals,
  type SpotDeal,
} from '../lib/api';
import { supabase } from '../lib/supabase';
import { useDialog } from '../contexts/DialogContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  colors as lightColors,
  fontWeight,
  letterSpacing,
  radius,
  shadow,
  spacing,
  typography,
} from '../constants/tokens';
import { PARKING_PLACEHOLDER_URI } from '../constants/images';

type Props = NativeStackScreenProps<
  RootStackParamList,
  'ParkingDetails'
>;

type ToastState = {
  message: string;
  type: 'success' | 'error';
} | null;

const HERO_HEIGHT = 280;
const SHEET_OVERLAP = 24;
const CONTROL_SIZE = 42;

export default function ParkingDetailsScreen({
  route,
  navigation,
}: Props) {
  const { spot } = route.params;
  const { showDialog } = useDialog();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  // Height of the sticky action bar, so scroll content can clear it.
  const [actionBarHeight, setActionBarHeight] = useState(96);

  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeSessionSpotId, setActiveSessionSpotId] = useState<string | null>(null);
  const [isSessionStatusLoading, setIsSessionStatusLoading] = useState(true);
  const [isParkingActionLoading, setIsParkingActionLoading] =
    useState(false);

  const [toast, setToast] = useState<ToastState>(null);

  // Story 8A: Deals state
  const [deals, setDeals] = useState<SpotDeal[]>([]);
  const [dealAccessToken, setDealAccessToken] = useState<string | null>(null);

  // Narrow the nullable spot ID to string | null.
  const validSpotId =
    typeof spot.id === 'string' && spot.id.trim().length > 0
      ? spot.id
      : null;

  const hasValidSpotId = validSpotId !== null;

  // Light status bar text over the photo hero while this screen is focused.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');

      return () => {
        setStatusBarStyle('auto');
      };
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadSpotAndSessionStatus = async () => {
        if (!validSpotId) {
          if (isActive) {
            setIsSaved(false);
            setSessionId(null);
            setActiveSessionSpotId(null);
            setIsSessionStatusLoading(false);
            setDeals([]);
            setDealAccessToken(null);
          }

          console.warn(
            'Cannot check saved status or active session: parking spot has no valid ID.',
          );
          return;
        }

        if (isActive) {
          setIsSessionStatusLoading(true);
          setDeals([]);
          setDealAccessToken(null);
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
              setDeals([]);
              setDealAccessToken(null);
            }
            return;
          }

          const accessToken = session.access_token;

          const [savedSpots, sessionHistory] = await Promise.all([
            getSavedSpots(accessToken),
            getParkingHistory(accessToken),
          ]);

          const saved = savedSpots.some(
            (savedSpot) => savedSpot.id === validSpotId,
          );

          const activeSession = sessionHistory.find(
            (item) => item.checked_out_at === null,
          );

          if (isActive) {
            setIsSaved(saved);
            setActiveSessionSpotId(activeSession?.spot_id ?? null);
            setSessionId(
              activeSession?.spot_id === validSpotId
                ? activeSession.id
                : null,
            );
            setDealAccessToken(accessToken);
          }

          // Fetch deals independently so a deals API failure
          // does not affect the rest of the parking details screen.
          try {
            const spotDeals = await getSpotDeals(
              validSpotId,
              accessToken,
            );

            if (isActive) {
              setDeals(spotDeals);
            }
          } catch (dealError) {
            console.error(
              '[ParkCity] Could not load deals:',
              dealError,
            );

            if (isActive) {
              setDeals([]);
            }
          }
        } catch (error) {
          console.error(
            'Could not load saved status or active session:',
            error,
          );
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
    }, [validSpotId]),
  );

  const handleToggleSaved = async () => {
    if (isSaving) {
      return;
    }

    if (!validSpotId) {
      showDialog({
        type: 'warning',
        title: 'Cannot save this spot',
        message:
          'This parking spot is temporarily unavailable for saving. Please try again later.',
      });
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
        showDialog({
          type: 'warning',
          title: 'Sign in required',
          message: 'Please sign in to save your favourite parking spots.',
          actions: [
            { label: 'Cancel', variant: 'secondary' },
            {
              label: 'Sign in',
              onPress: () =>
                navigation.navigate('EmailLogin', {
                  next: {
                    screen: 'ParkingDetails',
                    spot,
                  },
                }),
            },
          ],
        });
        return;
      }

      const action = isSaved ? 'unsave' : 'save';

      await toggleSavedSpot(
        session.access_token,
        validSpotId,
        action,
      );

      setIsSaved(!isSaved);
    } catch (error) {
      console.error('Could not update saved spot:', error);

      showDialog({
        type: 'error',
        title: 'Something went wrong',
        message:
          error instanceof Error
            ? error.message
            : 'Could not update your saved spots. Please try again.',
      });
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

    if (
      activeSessionSpotId &&
      activeSessionSpotId !== validSpotId &&
      !sessionId
    ) {
      setToast({
        message:
          'You already have an active parking session at another spot. Check out there before checking in here.',
        type: 'error',
      });
      return;
    }

    if (!validSpotId) {
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
        showDialog({
          type: 'warning',
          title: 'Sign in required',
          message: 'Please sign in to start a parking session.',
          actions: [
            { label: 'Cancel', variant: 'secondary' },
            {
              label: 'Sign in',
              onPress: () =>
                navigation.navigate('EmailLogin', {
                  next: {
                    screen: 'ParkingDetails',
                    spot,
                  },
                }),
            },
          ],
        });
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
          spotId: validSpotId,
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
        validSpotId,
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

    if (validSpotId) {
      void logNavigation(validSpotId).catch((error) => {
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
        showDialog({
          type: 'error',
          title: 'Something went wrong',
          message: 'Could not verify your sign-in status. Please try again.',
        });
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

      showDialog({
        type: 'error',
        title: 'Something went wrong',
        message: 'Could not verify your sign-in status. Please try again.',
      });
    }
  };

  const verificationTier =
    spot.verification_tier ??
    (spot.source === 'google_raw' ? 'google_raw' : 'unverified');

  // Same conditions as before, named for readability.
  const isParkingActionDisabled =
    isParkingActionLoading ||
    isSessionStatusLoading ||
    !hasValidSpotId ||
    (
      activeSessionSpotId !== null &&
      activeSessionSpotId !== validSpotId &&
      !sessionId
    );

  const parkingActionAccessibilityLabel =
    isSessionStatusLoading
      ? 'Checking session...'
      : sessionId
        ? "I've left"
        : activeSessionSpotId &&
          activeSessionSpotId !== validSpotId
          ? 'Active session elsewhere'
          : "I've parked here";

  const parkingActionTitle =
    isParkingActionLoading
      ? 'Please wait...'
      : isSessionStatusLoading
        ? 'Checking session...'
        : sessionId
          ? "I've left"
          : activeSessionSpotId &&
            activeSessionSpotId !== validSpotId
            ? 'Active session elsewhere'
            : "I've parked here";

  const isActiveElsewhere =
    !sessionId &&
    activeSessionSpotId !== null &&
    activeSessionSpotId !== validSpotId;

  const addressText =
    typeof spot.address === 'string' && spot.address.trim().length > 0
      ? spot.address
      : 'Parking location';

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: actionBarHeight + spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        {/* Photo hero */}
        <View style={styles.hero}>
          <Image
            source={{ uri: PARKING_PLACEHOLDER_URI }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
            accessible={false}
          />

          <View style={styles.heroTint} pointerEvents="none" />

          <LinearGradient
            colors={['rgba(31,27,20,0.35)', 'rgba(31,27,20,0)']}
            style={[styles.heroTopScrim, { height: insets.top + 72 }]}
            pointerEvents="none"
          />

          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [
              styles.heroControl,
              styles.backControl,
              { top: insets.top + spacing.sm },
              pressed && styles.heroControlPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Back to parking"
            hitSlop={6}
          >
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </Pressable>

          <Pressable
            onPress={handleToggleSaved}
            disabled={isSaving || !hasValidSpotId}
            style={({ pressed }) => [
              styles.heroControl,
              styles.favoriteControl,
              { top: insets.top + spacing.sm },
              isSaved && styles.favoriteControlActive,
              pressed && styles.heroControlPressed,
              (isSaving || !hasValidSpotId) &&
                styles.favoriteControlDisabled,
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
            hitSlop={6}
          >
            <Ionicons
              name={isSaved ? 'heart' : 'heart-outline'}
              size={20}
              color={isSaved ? colors.error : colors.textSecondary}
            />
          </Pressable>
        </View>

        {/* Information sheet */}
        <View style={styles.sheet}>
          <VerificationBadge tier={verificationTier} />

          <Text style={styles.name}>{spot.name}</Text>

          <View style={styles.addressRow}>
            <Ionicons
              name="location-outline"
              size={16}
              color={colors.textSecondary}
            />
            <Text style={styles.addressText} numberOfLines={2}>
              {addressText}
            </Text>
          </View>

          {!isSessionStatusLoading && sessionId && (
            <View style={[styles.statusChip, styles.statusChipParked]}>
              <View style={styles.statusDotParked} />
              <Text style={styles.statusTextParked}>
                You're parked here
              </Text>
            </View>
          )}

          {!isSessionStatusLoading && isActiveElsewhere && (
            <View style={[styles.statusChip, styles.statusChipElsewhere]}>
              <Ionicons
                name="time-outline"
                size={13}
                color={colors.goldDeep}
              />
              <Text style={styles.statusTextElsewhere}>
                Active session at another spot
              </Text>
            </View>
          )}

          {/* Pricing panel */}
          <View style={styles.pricePanel}>
            <View style={styles.priceText}>
              <Text style={styles.priceLabel}>Parking rate</Text>

              {spot.price_per_hour == null ? (
                <Text style={styles.priceUnavailable}>
                  Price unavailable
                </Text>
              ) : (
                <Text style={styles.price}>
                  ₹{spot.price_per_hour}
                  <Text style={styles.priceUnit}> /hr</Text>
                </Text>
              )}
            </View>

            <View style={styles.priceIcon}>
              <Ionicons
                name="cash-outline"
                size={20}
                color={colors.primaryDeep}
              />
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actionsCard}>
            <ListRow
              icon="navigate-outline"
              label="Get directions"
              subtitle="Open in Google Maps"
              onPress={handleNavigate}
              accessibilityLabel="Get Directions"
              showDivider
            />

            <ListRow
              icon="ribbon-outline"
              label="Claim this spot"
              subtitle="Own this parking? Verify ownership"
              onPress={handleClaim}
              accessibilityLabel="Claim this spot"
              showDivider
            />

            <ListRow
              icon="flag-outline"
              label="Report an issue"
              subtitle="Wrong price, closed or wrong location"
              onPress={() => navigation.navigate('ReportIssue', { spot })}
              accessibilityLabel="Report an issue with this parking spot"
              destructive
            />
          </View>

          {/* Story 8A: Deals & Redemption */}
          {deals.length > 0 && dealAccessToken && validSpotId && (
            <View style={styles.dealsSection}>
              <Text style={styles.dealsHeading}>
                Offers at this spot
              </Text>

              {deals.map((deal) => (
                <DealCard
                  key={deal.id}
                  deal={deal}
                  spotId={validSpotId}
                  accessToken={dealAccessToken}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky primary action */}
      <View
        style={[
          styles.actionBar,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
        onLayout={(event) =>
          setActionBarHeight(event.nativeEvent.layout.height)
        }
      >
        {toast && (
          <View style={styles.toastContainer}>
            <ToastMessage
              message={toast.message}
              type={toast.type}
            />
          </View>
        )}

        <PrimaryButton
          title={parkingActionTitle}
          variant={sessionId ? 'destructive' : 'primary'}
          onPress={handleParkingAction}
          disabled={isParkingActionDisabled}
          accessibilityLabel={parkingActionAccessibilityLabel}
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

    // Hero
    hero: {
      height: HERO_HEIGHT,
      backgroundColor: colors.skeleton,
      overflow: 'hidden',
    },
    heroTint: {
      ...StyleSheet.absoluteFill,
      backgroundColor: 'rgba(232,200,121,0.04)',
    },
    heroTopScrim: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
    },
    heroControl: {
      position: 'absolute',
      width: CONTROL_SIZE,
      height: CONTROL_SIZE,
      borderRadius: CONTROL_SIZE / 2,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadow.sm,
    },
    backControl: {
      left: spacing.md,
    },
    favoriteControl: {
      right: spacing.md,
    },
    heroControlPressed: {
      opacity: 0.8,
    },
    favoriteControlActive: {
      backgroundColor: colors.favoriteBackground,
      borderWidth: 1,
      borderColor: colors.favoriteBorder,
    },
    favoriteControlDisabled: {
      opacity: 0.6,
    },

    // Information sheet
    sheet: {
      marginTop: -SHEET_OVERLAP,
      borderTopLeftRadius: radius.xxl,
      borderTopRightRadius: radius.xxl,
      backgroundColor: colors.background,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
    },
    name: {
      marginTop: 12,
      color: colors.text,
      fontSize: typography.title,
      lineHeight: typography.titleLineHeight,
      fontWeight: fontWeight.bold,
      letterSpacing: letterSpacing.tight,
    },
    addressRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 6,
      marginTop: spacing.sm,
    },
    addressText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: typography.small,
      lineHeight: typography.smallLineHeight,
    },
    statusChip: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 12,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.pill,
    },
    statusChipParked: {
      backgroundColor: colors.primarySoft,
    },
    statusDotParked: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
    statusTextParked: {
      color: colors.primaryDeep,
      fontSize: typography.caption,
      fontWeight: fontWeight.semibold,
    },
    statusChipElsewhere: {
      backgroundColor: colors.champagneSoft,
    },
    statusTextElsewhere: {
      color: colors.goldDeep,
      fontSize: typography.caption,
      fontWeight: fontWeight.semibold,
    },

    // Pricing panel
    pricePanel: {
      marginTop: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: 14,
      borderRadius: radius.xl,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...shadow.sm,
    },
    priceText: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    priceLabel: {
      color: colors.textSecondary,
      fontSize: typography.caption,
      lineHeight: typography.captionLineHeight,
      fontWeight: fontWeight.medium,
    },
    price: {
      color: colors.primaryDeep,
      fontSize: 24,
      lineHeight: 30,
      fontWeight: fontWeight.bold,
      letterSpacing: letterSpacing.snug,
    },
    priceUnit: {
      color: colors.textSecondary,
      fontSize: typography.small,
      fontWeight: fontWeight.regular,
    },
    priceUnavailable: {
      color: colors.textSecondary,
      fontSize: 17,
      lineHeight: 24,
      fontWeight: fontWeight.semibold,
    },
    priceIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Actions
    actionsCard: {
      marginTop: spacing.md,
      borderRadius: radius.xl,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      overflow: 'hidden',
    },

    // Offers
    dealsSection: {
      marginTop: spacing.xl,
    },
    dealsHeading: {
      color: colors.text,
      fontSize: typography.headline,
      lineHeight: typography.headlineLineHeight,
      fontWeight: fontWeight.bold,
      letterSpacing: letterSpacing.snug,
      marginBottom: spacing.md,
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
    toastContainer: {
      marginBottom: spacing.sm,
    },
  });
