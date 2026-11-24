
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../App';
import { supabase } from '../lib/supabase';
import {
  getOwnerListings,
  getSpotAvailability,
  updateSpotAvailability,
  type ListingDetails,
  type OwnerListing,
} from '../lib/api';
import { useTheme } from '../contexts/ThemeContext';
import { useDialog } from '../contexts/DialogContext';
import { useKeyboardAwareScroll } from '../hooks/useKeyboardAwareScroll';
import VerificationBadge from '../components/VerificationBadge';
import PrimaryButton from '../components/ui/PrimaryButton';
import EmptyState from '../components/ui/EmptyState';
import SkeletonCard from '../components/ui/SkeletonCard';
import {
  colors as lightColors,
  fontWeight,
  letterSpacing,
  radius,
  shadow,
  spacing,
  typography,
} from '../constants/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'MyListings'>;

type OwnerSpot = {
  stats: OwnerListing;
  details: ListingDetails;
};

type AvailabilityDraft = {
  total: string;
  available: string;
};

type IoniconName = keyof typeof Ionicons.glyphMap;

const statusLabels: Record<ListingDetails['availability_status'], string> = {
  live: 'Live availability',
  stale: 'Recently updated',
  unconfirmed: 'Availability unconfirmed',
};

export default function MyListingsScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardAwareScroll();
  const { showDialog } = useDialog();

  const [listings, setListings] = useState<OwnerSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [screenError, setScreenError] = useState<string | null>(null);

  const [savingSpotId, setSavingSpotId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, AvailabilityDraft>>({});

  // Owner-level metrics derived from the per-listing stats returned by the API.
  const totalViews = listings.reduce(
    (total, spot) => total + spot.stats.views,
    0
  );

  const totalNavigations = listings.reduce(
    (total, spot) => total + spot.stats.navigations,
    0
  );

  const navigationConversion =
    totalViews > 0 ? (totalNavigations / totalViews) * 100 : 0;

  const loadListings = useCallback(async () => {
    setScreenError(null);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error('Please sign in to view your listings.');
      }

      const ownerListings = await getOwnerListings(accessToken);

      const results = await Promise.allSettled(
        ownerListings.map(async (stats) => {
          const details = await getSpotAvailability(stats.spot_id);

          return {
            stats,
            details,
          };
        })
      );

      const successfulListings: OwnerSpot[] = results
        .filter(
          (result): result is PromiseFulfilledResult<OwnerSpot> =>
            result.status === 'fulfilled'
        )
        .map((result) => result.value);

      setListings(successfulListings);

      if (results.some((result) => result.status === 'rejected')) {
        setScreenError(
          'Some listings could not be loaded. Pull down to try again.'
        );
      }
    } catch (error) {
      setScreenError(
        error instanceof Error
          ? error.message
          : 'Something went wrong while loading your listings.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadListings();
    });

    return unsubscribe;
  }, [navigation, loadListings]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadListings();
  };

  const handleDraftChange = (
    spotId: string,
    field: keyof AvailabilityDraft,
    value: string
  ) => {
    if (!/^\d*$/.test(value)) {
      return;
    }

    setDrafts((previous) => ({
      ...previous,
      [spotId]: {
        total: previous[spotId]?.total ?? '',
        available: previous[spotId]?.available ?? '',
        [field]: value,
      },
    }));
  };

  const handleInitialSetup = async (spot: OwnerSpot) => {
    const draft = drafts[spot.details.id];

    const total = Number(draft?.total);
    const available = Number(draft?.available);

    if (
      !draft ||
      draft.total.trim() === '' ||
      draft.available.trim() === '' ||
      !Number.isInteger(total) ||
      !Number.isInteger(available) ||
      total <= 0 ||
      available < 0 ||
      available > total
    ) {
      showDialog({
        type: 'warning',
        title: 'Invalid availability',
        message:
          'Enter a valid total number of slots and available slots. Available slots cannot exceed total slots.',
      });
      return;
    }

    await saveAvailability(spot, available, total);
  };

  const handleAvailabilityChange = async (
    spot: OwnerSpot,
    change: number
  ) => {
    const currentAvailable = spot.details.available_count;
    const total = spot.details.total_count;

    if (currentAvailable === null || total === null) {
      return;
    }

    const nextAvailable = Math.max(
      0,
      Math.min(total, currentAvailable + change)
    );

    if (nextAvailable === currentAvailable) {
      return;
    }

    await saveAvailability(spot, nextAvailable, total);
  };

  const saveAvailability = async (
    spot: OwnerSpot,
    available: number,
    total: number
  ) => {
    const spotId = spot.details.id;

    if (savingSpotId) {
      return;
    }

    setSavingSpotId(spotId);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error('Your session has expired. Please sign in again.');
      }

      await updateSpotAvailability(
        accessToken,
        spotId,
        available,
        total
      );

      setListings((previous) =>
        previous.map((listing) => {
          if (listing.details.id !== spotId) {
            return listing;
          }

          return {
            ...listing,
            details: {
              ...listing.details,
              available_count: available,
              total_count: total,
              availability_status: 'live',
              availability_updated_at: new Date().toISOString(),
            },
          };
        })
      );

      setDrafts((previous) => {
        const next = { ...previous };
        delete next[spotId];
        return next;
      });
    } catch (error) {
      showDialog({
        type: 'error',
        title: 'Update failed',
        message:
          error instanceof Error
            ? error.message
            : 'Could not update availability. Please try again.',
      });
    } finally {
      setSavingSpotId(null);
    }
  };

  const getPrice = (details: ListingDetails) => {
    const ownerPrice = details.attributes?.price_per_hour?.value;

    if (ownerPrice != null && ownerPrice.trim() !== '') {
      const parsedPrice = Number(ownerPrice);

      if (Number.isFinite(parsedPrice)) {
        return `₹${parsedPrice}/hr`;
      }
    }

    if (details.price_per_hour != null) {
      return `₹${details.price_per_hour}/hr`;
    }

    return 'Price unavailable';
  };

  // ---------- Presentation helpers ----------

  const statusTone = (details: ListingDetails) => {
    if (details.available_count === null || details.total_count === null) {
      return 'neutral' as const;
    }
    if (details.availability_status === 'live') return 'live' as const;
    if (details.availability_status === 'stale') return 'stale' as const;
    return 'neutral' as const;
  };

  const metricTile = (
    icon: IoniconName,
    label: string,
    value: string,
    hint?: string,
  ) => (
    <View style={styles.metricTile}>
      <View style={styles.metricIcon}>
        <Ionicons name={icon} size={16} color={colors.goldDeep} />
      </View>
      <Text style={styles.metricValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.metricLabel} numberOfLines={1}>
        {label}
      </Text>
      {hint ? <Text style={styles.metricHint}>{hint}</Text> : null}
    </View>
  );

  const renderAvailability = (spot: OwnerSpot) => {
    const { details } = spot;
    const isSaving = savingSpotId === details.id;

    if (
      details.available_count === null ||
      details.total_count === null
    ) {
      const draft = drafts[details.id] ?? {
        total: '',
        available: '',
      };

      return (
        <View style={styles.availabilityBox}>
          <View style={styles.availabilityTitleRow}>
            <Ionicons
              name="options-outline"
              size={16}
              color={colors.goldDeep}
            />
            <Text style={styles.availabilityTitle}>
              Set up availability
            </Text>
          </View>

          <Text style={styles.helperText}>
            Add your parking capacity to start managing available slots.
          </Text>

          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Total slots</Text>

              <TextInput
                value={draft.total}
                onChangeText={(value) =>
                  handleDraftChange(details.id, 'total', value)
                }
                onFocus={keyboard.revealOnFocus}
                keyboardType="number-pad"
                placeholder="e.g. 10"
                placeholderTextColor={colors.textSecondary}
                style={styles.numberInput}
                accessibilityLabel={`Total slots for ${details.name}`}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Available now</Text>

              <TextInput
                value={draft.available}
                onChangeText={(value) =>
                  handleDraftChange(details.id, 'available', value)
                }
                onFocus={keyboard.revealOnFocus}
                keyboardType="number-pad"
                placeholder="e.g. 4"
                placeholderTextColor={colors.textSecondary}
                style={styles.numberInput}
                accessibilityLabel={`Available slots now for ${details.name}`}
              />
            </View>
          </View>

          <PrimaryButton
            title="Save availability"
            loading={isSaving}
            disabled={savingSpotId !== null}
            onPress={() => handleInitialSetup(spot)}
          />
        </View>
      );
    }

    const available = details.available_count;
    const total = details.total_count;
    const decreaseDisabled = available <= 0 || savingSpotId !== null;
    const increaseDisabled = available >= total || savingSpotId !== null;
    const fillRatio = total > 0 ? Math.min(1, available / total) : 0;

    return (
      <View style={styles.availabilityBox}>
        <View style={styles.availabilityHeading}>
          <View style={styles.availabilityText}>
            <Text style={styles.availabilityTitle}>Available slots</Text>
            <Text style={styles.helperText}>
              {available} of {total} parking slots available
            </Text>
          </View>

          <View style={styles.stepper}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Decrease available slots"
              accessibilityState={{ disabled: decreaseDisabled }}
              disabled={decreaseDisabled}
              onPress={() => handleAvailabilityChange(spot, -1)}
              hitSlop={6}
              style={({ pressed }) => [
                styles.stepperButton,
                decreaseDisabled && styles.stepperButtonDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="remove" size={20} color={colors.primaryDeep} />
            </Pressable>

            <Text style={styles.availableCount}>{available}</Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Increase available slots"
              accessibilityState={{ disabled: increaseDisabled }}
              disabled={increaseDisabled}
              onPress={() => handleAvailabilityChange(spot, 1)}
              hitSlop={6}
              style={({ pressed }) => [
                styles.stepperButton,
                increaseDisabled && styles.stepperButtonDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="add" size={20} color={colors.primaryDeep} />
            </Pressable>
          </View>
        </View>

        {/* Display-only occupancy bar */}
        <View style={styles.progressTrack}>
          <View
            style={[styles.progressFill, { width: `${fillRatio * 100}%` }]}
          />
        </View>

        {isSaving && (
          <View style={styles.savingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.savingText}>Saving availability...</Text>
          </View>
        )}
      </View>
    );
  };

  const header = (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() => navigation.goBack()}
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        hitSlop={6}
      >
        <Ionicons name="arrow-back" size={20} color={colors.text} />
      </Pressable>

      <Text style={styles.eyebrow}>OWNER DASHBOARD</Text>
      <Text style={styles.title}>My Listings</Text>
      <Text style={styles.subtitle}>Manage your parking spaces</Text>
    </>
  );

  if (loading) {
    return (
      <View
        style={[
          styles.screen,
          styles.content,
          { paddingTop: insets.top + spacing.sm },
        ]}
      >
        {header}
        <Text style={styles.loadingText}>Loading your listings...</Text>
        <SkeletonCard />
        <SkeletonCard />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        ref={keyboard.scrollRef}
        onScroll={keyboard.handleScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + spacing.sm,
            paddingBottom:
              Math.max(insets.bottom, spacing.md) +
              spacing.xl +
              keyboard.keyboardHeight,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        {header}

        {listings.length > 0 && (
          <View style={styles.overviewCard}>
            <View style={styles.overviewHeading}>
              <Text style={styles.overviewTitle}>Performance overview</Text>
              <Text style={styles.overviewSubtitle}>
                All your parking listings
              </Text>
            </View>

            <View style={styles.metricsGrid}>
              {metricTile(
                'eye-outline',
                'Total views',
                totalViews.toLocaleString('en-IN'),
              )}
              {metricTile(
                'navigate-outline',
                'Navigations',
                totalNavigations.toLocaleString('en-IN'),
              )}
              {metricTile(
                'trending-up-outline',
                'Conversion',
                `${navigationConversion.toFixed(1)}%`,
                'Navigations / views',
              )}
              {metricTile(
                'business-outline',
                'Active listings',
                String(listings.length),
              )}
            </View>
          </View>
        )}

        {screenError && (
          <View style={styles.errorBanner}>
            <Ionicons
              name="alert-circle"
              size={18}
              color={colors.errorText}
            />
            <Text style={styles.errorText}>{screenError}</Text>
          </View>
        )}

        {listings.length === 0 && !screenError ? (
          <View style={styles.emptyCard}>
            <EmptyState
              icon="business-outline"
              heading="No listings yet"
              subtext="Parking spaces you claim will appear here."
            />
          </View>
        ) : listings.length > 0 ? (
          <>
            <Text style={styles.listingCount}>
              {listings.length}{' '}
              {listings.length === 1 ? 'LISTING' : 'LISTINGS'}
            </Text>

            {listings.map((spot) => {
              const { details, stats } = spot;

              const verificationTier =
                details.verification_tier === 'field_verified' ||
                details.verification_tier === 'owner_verified' ||
                details.verification_tier === 'crowd_verified' ||
                details.verification_tier === 'google_raw'
                  ? details.verification_tier
                  : 'unverified';

              const tone = statusTone(details);

              return (
                <View key={details.id} style={styles.listingCard}>
                  <View style={styles.cardTopRow}>
                    <View style={styles.spotIcon}>
                      <Ionicons
                        name="car-outline"
                        size={20}
                        color={colors.goldDeep}
                      />
                    </View>

                    <View style={styles.titleContainer}>
                      <Text numberOfLines={2} style={styles.spotName}>
                        {details.name}
                      </Text>

                      <Text numberOfLines={2} style={styles.address}>
                        {details.address || 'Address unavailable'}
                      </Text>

                      <View style={styles.badgeRow}>
                        <VerificationBadge tier={verificationTier} />
                      </View>
                    </View>
                  </View>

                  <View style={styles.infoStrip}>
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>RATE</Text>
                      <Text style={styles.infoValue} numberOfLines={1}>
                        {getPrice(details)}
                      </Text>
                    </View>

                    <View style={styles.infoDivider} />

                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>VIEWS</Text>
                      <Text style={styles.infoValue}>{stats.views}</Text>
                    </View>

                    <View style={styles.infoDivider} />

                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>NAVIGATIONS</Text>
                      <Text style={styles.infoValue}>{stats.navigations}</Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.statusChip,
                      tone === 'live'
                        ? styles.statusChipLive
                        : tone === 'stale'
                          ? styles.statusChipStale
                          : styles.statusChipNeutral,
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        {
                          backgroundColor:
                            details.availability_status === 'live'
                              ? colors.success
                              : details.availability_status === 'stale'
                                ? colors.warning
                                : colors.textSecondary,
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusText,
                        tone === 'live'
                          ? styles.statusTextLive
                          : tone === 'stale'
                            ? styles.statusTextStale
                            : styles.statusTextNeutral,
                      ]}
                    >
                      {details.available_count === null ||
                      details.total_count === null
                        ? 'Availability unconfirmed'
                        : statusLabels[details.availability_status]}
                    </Text>
                  </View>

                  {renderAvailability(spot)}
                </View>
              );
            })}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingHorizontal: spacing.lg,
    },
    pressed: {
      opacity: 0.75,
    },

    // Header
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
      marginBottom: spacing.lg,
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginBottom: spacing.md,
    },

    // Overview
    overviewCard: {
      padding: spacing.md,
      borderRadius: radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginBottom: spacing.md,
      ...shadow.sm,
    },
    overviewHeading: {
      marginBottom: 12,
    },
    overviewTitle: {
      color: colors.text,
      fontSize: 16,
      lineHeight: 22,
      fontWeight: fontWeight.bold,
    },
    overviewSubtitle: {
      color: colors.textSecondary,
      fontSize: typography.caption,
      lineHeight: typography.captionLineHeight,
      marginTop: 2,
    },
    metricsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: 10,
    },
    metricTile: {
      width: '48.5%',
      padding: 12,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceMuted,
    },
    metricIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.champagneSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    metricValue: {
      color: colors.text,
      fontSize: 22,
      lineHeight: 28,
      fontWeight: fontWeight.bold,
      letterSpacing: letterSpacing.snug,
    },
    metricLabel: {
      color: colors.textSecondary,
      fontSize: typography.caption,
      lineHeight: typography.captionLineHeight,
      marginTop: 1,
    },
    metricHint: {
      color: colors.textSecondary,
      fontSize: 11,
      lineHeight: 14,
      marginTop: 2,
    },

    // Error / empty
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      padding: 12,
      borderRadius: radius.lg,
      backgroundColor: colors.errorSoft,
      marginBottom: spacing.md,
    },
    errorText: {
      flex: 1,
      color: colors.text,
      fontSize: typography.small,
      lineHeight: typography.smallLineHeight,
    },
    emptyCard: {
      borderRadius: radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },

    // Listing cards
    listingCount: {
      color: colors.goldDeep,
      fontSize: typography.overline,
      lineHeight: typography.overlineLineHeight,
      fontWeight: fontWeight.bold,
      letterSpacing: letterSpacing.overline,
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
      marginLeft: spacing.xs,
    },
    listingCard: {
      padding: spacing.md,
      borderRadius: radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginBottom: spacing.md,
      ...shadow.sm,
    },
    cardTopRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    spotIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.champagneSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    titleContainer: {
      flex: 1,
      minWidth: 0,
    },
    spotName: {
      color: colors.text,
      fontSize: 17,
      lineHeight: 22,
      fontWeight: fontWeight.bold,
      letterSpacing: letterSpacing.snug,
    },
    address: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
      marginTop: 2,
    },
    badgeRow: {
      marginTop: spacing.sm,
    },
    infoStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 14,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceMuted,
    },
    infoItem: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
    },
    infoDivider: {
      width: StyleSheet.hairlineWidth,
      height: 28,
      backgroundColor: colors.borderStrong,
    },
    infoLabel: {
      color: colors.textSecondary,
      fontSize: 10,
      lineHeight: 13,
      fontWeight: fontWeight.semibold,
      letterSpacing: 0.6,
    },
    infoValue: {
      color: colors.text,
      fontSize: 15,
      lineHeight: 20,
      fontWeight: fontWeight.bold,
      marginTop: 2,
    },
    statusChip: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 12,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: radius.pill,
    },
    statusChipLive: {
      backgroundColor: colors.primarySoft,
    },
    statusChipStale: {
      backgroundColor: colors.champagneSoft,
    },
    statusChipNeutral: {
      backgroundColor: colors.surfaceMuted,
    },
    statusDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    statusText: {
      fontSize: typography.caption,
      fontWeight: fontWeight.semibold,
    },
    statusTextLive: {
      color: colors.primaryDeep,
    },
    statusTextStale: {
      color: colors.goldDeep,
    },
    statusTextNeutral: {
      color: colors.textSecondary,
    },

    // Availability
    availabilityBox: {
      marginTop: 14,
      paddingTop: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      gap: 10,
    },
    availabilityTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    availabilityHeading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    availabilityText: {
      flex: 1,
      minWidth: 0,
    },
    availabilityTitle: {
      color: colors.text,
      fontSize: 15,
      lineHeight: 20,
      fontWeight: fontWeight.bold,
    },
    helperText: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
      marginTop: 2,
    },
    inputRow: {
      flexDirection: 'row',
      gap: 12,
    },
    inputGroup: {
      flex: 1,
    },
    inputLabel: {
      color: colors.text,
      fontSize: typography.caption + 1,
      fontWeight: fontWeight.medium,
      marginBottom: 6,
    },
    numberInput: {
      minHeight: 48,
      paddingHorizontal: 14,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.textSecondary,
      backgroundColor: colors.surface,
      color: colors.text,
      fontSize: typography.body,
    },
    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    stepperButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperButtonDisabled: {
      opacity: 0.4,
    },
    availableCount: {
      minWidth: 34,
      textAlign: 'center',
      color: colors.text,
      fontSize: 22,
      lineHeight: 28,
      fontWeight: fontWeight.bold,
      fontVariant: ['tabular-nums'],
    },
    progressTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.surfaceMuted,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 3,
      backgroundColor: colors.primary,
    },
    savingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    savingText: {
      color: colors.textSecondary,
      fontSize: typography.caption + 1,
    },
  });
