import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
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
import VerificationBadge from '../components/VerificationBadge';
import PrimaryButton from '../components/ui/PrimaryButton';
import {
  fontWeight,
  radius,
  shadow,
  size,
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

const statusLabels: Record<ListingDetails['availability_status'], string> = {
  live: 'Live availability',
  stale: 'Recently updated',
  unconfirmed: 'Availability unconfirmed',
};

export default function MyListingsScreen({ navigation }: Props) {
  const { colors } = useTheme();

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
      Alert.alert(
        'Invalid availability',
        'Enter a valid total number of slots and available slots. Available slots cannot exceed total slots.'
      );
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
      Alert.alert(
        'Update failed',
        error instanceof Error
          ? error.message
          : 'Could not update availability. Please try again.'
      );
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
        <View
          style={[
            styles.setupContainer,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Set up availability
          </Text>

          <Text
            style={[
              styles.helperText,
              { color: colors.textSecondary },
            ]}
          >
            Add your parking capacity to start managing available slots.
          </Text>

          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                Total slots
              </Text>

              <TextInput
                value={draft.total}
                onChangeText={(value) =>
                  handleDraftChange(details.id, 'total', value)
                }
                keyboardType="number-pad"
                placeholder="e.g. 10"
                placeholderTextColor={colors.textSecondary}
                style={[
                  styles.numberInput,
                  {
                    color: colors.text,
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                Available now
              </Text>

              <TextInput
                value={draft.available}
                onChangeText={(value) =>
                  handleDraftChange(details.id, 'available', value)
                }
                keyboardType="number-pad"
                placeholder="e.g. 4"
                placeholderTextColor={colors.textSecondary}
                style={[
                  styles.numberInput,
                  {
                    color: colors.text,
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
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

    return (
      <View
        style={[
          styles.availabilityContainer,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.availabilityHeading}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Available slots
            </Text>

            <Text style={[styles.helperText, { color: colors.textSecondary }]}>
              {available} of {total} parking slots available
            </Text>
          </View>

          <View style={styles.stepper}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Decrease available slots"
              accessibilityState={{
                disabled: available <= 0 || savingSpotId !== null,
              }}
              disabled={available <= 0 || savingSpotId !== null}
              onPress={() => handleAvailabilityChange(spot, -1)}
              style={[
                styles.stepperButton,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: available <= 0 || savingSpotId !== null ? 0.4 : 1,
                },
              ]}
            >
              <Text style={[styles.stepperText, { color: colors.text }]}>
                −
              </Text>
            </Pressable>

            <Text
              style={[
                styles.availableCount,
                { color: colors.text },
              ]}
            >
              {available}
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Increase available slots"
              accessibilityState={{
                disabled: available >= total || savingSpotId !== null,
              }}
              disabled={available >= total || savingSpotId !== null}
              onPress={() => handleAvailabilityChange(spot, 1)}
              style={[
                styles.stepperButton,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: available >= total || savingSpotId !== null ? 0.4 : 1,
                },
              ]}
            >
              <Text style={[styles.stepperText, { color: colors.text }]}>
                +
              </Text>
            </Pressable>
          </View>
        </View>

        {isSaving && (
          <View style={styles.savingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.savingText, { color: colors.textSecondary }]}>
              Saving availability...
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View
        style={[
          styles.centerContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading your listings...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={[styles.backText, { color: colors.text }]}>
            ‹
          </Text>
        </Pressable>

        <View style={styles.headerTextContainer}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            My Listings
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            Manage your parking spaces
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {listings.length > 0 && (
          <View style={styles.overviewSection}>
            <View style={styles.overviewHeading}>
              <Text style={[styles.overviewTitle, { color: colors.text }]}>
                Performance overview
              </Text>
              <Text style={[styles.overviewSubtitle, { color: colors.textSecondary }]}>
                All your parking listings
              </Text>
            </View>

            <View style={styles.metricsGrid}>
              <View
                style={[
                  styles.metricCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                  TOTAL VIEWS
                </Text>
                <Text style={[styles.metricValue, { color: colors.text }]}>
                  {totalViews.toLocaleString('en-IN')}
                </Text>
              </View>

              <View
                style={[
                  styles.metricCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                  NAVIGATIONS
                </Text>
                <Text style={[styles.metricValue, { color: colors.text }]}>
                  {totalNavigations.toLocaleString('en-IN')}
                </Text>
              </View>

              <View
                style={[
                  styles.metricCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                  CONVERSION
                </Text>
                <Text style={[styles.metricValue, { color: colors.text }]}>
                  {navigationConversion.toFixed(1)}%
                </Text>
                <Text style={[styles.metricHint, { color: colors.textSecondary }]}>
                  Navigations / views
                </Text>
              </View>

              <View
                style={[
                  styles.metricCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                  ACTIVE LISTINGS
                </Text>
                <Text style={[styles.metricValue, { color: colors.text }]}>
                  {listings.length}
                </Text>
              </View>
            </View>
          </View>
        )}

        {screenError && (
          <View
            style={[
              styles.errorContainer,
              {
                backgroundColor: colors.surface,
                borderColor: colors.error,
              },
            ]}
          >
            <Text style={[styles.errorText, { color: colors.error }]}>
              {screenError}
            </Text>
          </View>
        )}

        {listings.length === 0 && !screenError ? (
          <View
            style={[
              styles.emptyContainer,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No listings yet
            </Text>

            <Text style={[styles.emptyDescription, { color: colors.textSecondary }]}>
              Parking spaces you claim will appear here.
            </Text>
          </View>
        ) : listings.length > 0 ? (
          <>
            <Text style={[styles.listingCount, { color: colors.textSecondary }]}>
              {listings.length} {listings.length === 1 ? 'listing' : 'listings'}
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

              return (
                <View
                  key={details.id}
                  style={[
                    styles.listingCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.cardTopRow}>
                    <View style={styles.titleContainer}>
                      <Text
                        numberOfLines={2}
                        style={[styles.spotName, { color: colors.text }]}
                      >
                        {details.name}
                      </Text>

                      <Text
                        numberOfLines={2}
                        style={[
                          styles.address,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {details.address || 'Address unavailable'}
                      </Text>
                    </View>

                    <VerificationBadge tier={verificationTier} />
                  </View>

                  <View
                    style={[
                      styles.priceRow,
                      { borderTopColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>
                      PARKING RATE
                    </Text>

                    <Text style={[styles.priceValue, { color: colors.text }]}>
                      {getPrice(details)}
                    </Text>
                  </View>

                  <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                      <Text style={[styles.statValue, { color: colors.text }]}>
                        {stats.views}
                      </Text>
                      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                        Views
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statDivider,
                        { backgroundColor: colors.border },
                      ]}
                    />

                    <View style={styles.statItem}>
                      <Text style={[styles.statValue, { color: colors.text }]}>
                        {stats.navigations}
                      </Text>
                      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                        Navigations
                      </Text>
                    </View>
                  </View>

                  <View style={styles.statusRow}>
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
                        { color: colors.textSecondary },
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },

  loadingText: {
    fontSize: typography.body,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  backButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },

  backText: {
    fontSize: 34,
    lineHeight: 38,
  },

  headerTextContainer: {
    flex: 1,
  },

  headerTitle: {
    fontSize: 22,
    fontWeight: fontWeight.bold,
  },

  headerSubtitle: {
    fontSize: typography.small,
    marginTop: 2,
  },

  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },

  overviewSection: {
    marginBottom: spacing.lg,
  },

  overviewHeading: {
    marginBottom: spacing.md,
  },

  overviewTitle: {
    fontSize: 19,
    fontWeight: fontWeight.bold,
  },

  overviewSubtitle: {
    fontSize: typography.small,
    marginTop: spacing.xs,
  },

  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },

  metricCard: {
    width: '48%',
    flexGrow: 1,
    minHeight: 104,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    justifyContent: 'center',
    ...shadow.sm,
  },

  metricLabel: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.8,
  },

  metricValue: {
    fontSize: 26,
    fontWeight: fontWeight.bold,
    marginTop: spacing.xs,
  },

  metricHint: {
    fontSize: 11,
    marginTop: 2,
  },

  listingCount: {
    fontSize: typography.small,
    fontWeight: fontWeight.medium,
    marginBottom: spacing.md,
  },

  listingCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadow.sm,
  },

  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },

  titleContainer: {
    flex: 1,
  },

  spotName: {
    fontSize: 19,
    fontWeight: fontWeight.bold,
    lineHeight: 25,
  },

  address: {
    fontSize: typography.small,
    lineHeight: typography.smallLineHeight,
    marginTop: spacing.xs,
  },

  priceRow: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  priceLabel: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    letterSpacing: 1,
  },

  priceValue: {
    fontSize: typography.body,
    fontWeight: fontWeight.semibold,
  },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },

  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },

  statValue: {
    fontSize: 18,
    fontWeight: fontWeight.bold,
  },

  statLabel: {
    fontSize: 12,
  },

  statDivider: {
    width: 1,
    height: 32,
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  statusText: {
    fontSize: typography.small,
    fontWeight: fontWeight.medium,
  },

  setupContainer: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },

  availabilityContainer: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },

  sectionTitle: {
    fontSize: typography.body,
    fontWeight: fontWeight.semibold,
  },

  helperText: {
    fontSize: typography.small,
    lineHeight: typography.smallLineHeight,
    marginTop: spacing.xs,
  },

  inputRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },

  inputGroup: {
    flex: 1,
    gap: spacing.xs,
  },

  inputLabel: {
    fontSize: 12,
    fontWeight: fontWeight.medium,
  },

  numberInput: {
    height: size.inputHeight,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.body,
  },

  availabilityHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  stepperButton: {
    width: 38,
    height: 38,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  stepperText: {
    fontSize: 23,
    lineHeight: 26,
    fontWeight: fontWeight.medium,
  },

  availableCount: {
    minWidth: 24,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: fontWeight.bold,
  },

  savingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },

  savingText: {
    fontSize: 12,
  },

  errorContainer: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },

  errorText: {
    fontSize: typography.small,
    lineHeight: typography.smallLineHeight,
  },

  emptyContainer: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.xl,
  },

  emptyTitle: {
    fontSize: 19,
    fontWeight: fontWeight.bold,
  },

  emptyDescription: {
    fontSize: typography.small,
    textAlign: 'center',
    lineHeight: typography.smallLineHeight,
    marginTop: spacing.sm,
  },
});