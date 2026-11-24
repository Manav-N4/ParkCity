
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useFocusEffect,
  type CompositeScreenProps,
} from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../App';
import type { MainTabParamList } from '../navigation/MainTabNavigator';
import ParkingSpotCard from '../components/ParkingSpotCard';
import SponsoredCard from '../components/SponsoredCard';
import SearchBar, { Suggestion } from '../components/ui/SearchBar';
import SkeletonCard from '../components/ui/SkeletonCard';
import EmptyState from '../components/ui/EmptyState';
import CitySkyline from '../components/ui/CitySkyline';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import {
  colors as lightColors,
  fontWeight,
  letterSpacing,
  radius,
  shadow,
  spacing,
  typography,
} from '../constants/tokens';
import { destinationImages } from '../constants/images';
import {
  getPlaceDetails,
  searchNearbyParking,
  getParkingHistory,
  getSpotAvailability,
  type ParkingHistoryItem,
} from '../lib/api';
import {
  distanceMeters,
  formatDistance,
  withTimeout,
} from '../lib/locationQuality';
import { supabase } from '../lib/supabase';
import { useDialog } from '../contexts/DialogContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ParkingSpot, type VerificationTier } from '../types/parking';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

const destinations = [
  {
    number: '01',
    name: 'Lalbagh Botanical Garden',
    area: 'Lalbagh Road',
    google_place_id: 'ChIJHdPykcEVrjsRIr4v35kLEY4',
    image: destinationImages.lalbagh,
    size: 'large',
  },
  {
    number: '02',
    name: 'Kempegowda International Airport',
    area: 'Devanahalli',
    google_place_id: 'ChIJZWJEdf4crjsRjkEpoelwbCk',
    image: destinationImages.airport,
    size: 'small',
  },
  {
    number: '03',
    name: 'Vidhana Soudha',
    area: 'Central Bengaluru',
    google_place_id: 'ChIJt-j-2G0WrjsRU5RX3HUnEaM',
    image: destinationImages.vidhanaSoudha,
    size: 'small',
  },
] as const;

type SponsoredSpotData = {
  id: string;
  name: string;
  address?: string | null;
  price_per_hour?: number | null;
  source?: string;
};

type NearbyStatus =
  | 'loading'
  | 'ready'
  | 'denied'
  | 'blocked'
  | 'servicesOff'
  | 'error';

type NearbySpot = ParkingSpot & { distance: number | null };

// How many nearby spots to show on Home; the rest are under "See all".
const NEARBY_PREVIEW_COUNT = 8;
const NEARBY_CARD_WIDTH = 176;
const NEARBY_CARD_GAP = 12;
// Reuse a recent fix so Home opens fast.
const LAST_KNOWN_MAX_AGE_MS = 5 * 60 * 1000;
const FRESH_FIX_TIMEOUT_MS = 12 * 1000;

const DESTINATION_CARD_WIDTH = 200;
const DESTINATION_CARD_GAP = 12;

// Bubble height + its bottom offset + breathing room, so the
// currently-parked bubble never covers the last card.
const ACTIVE_BUBBLE_CLEARANCE = 112;

// Places the user picked from search suggestions, stored on the device.
type RecentSearch = { placeId: string; description: string };
const RECENT_SEARCHES_KEY = 'recent_place_searches';
const MAX_RECENT_SEARCHES = 5;

// A spot the user previously parked at, from their parking history.
type ParkAgainSpot = {
  spotId: string;
  name: string;
  address: string | null;
  lastParkedAt: string;
};
const MAX_PARK_AGAIN = 6;

const VERIFICATION_TIERS: VerificationTier[] = [
  'field_verified',
  'owner_verified',
  'crowd_verified',
  'google_raw',
  'unverified',
];

// Ticket card geometry: top block, tear line, bottom row.
const TICKET_TOP_HEIGHT = 88;
const TICKET_TEAR_HEIGHT = 14;
const TICKET_NOTCH_SIZE = 14;
const TICKET_DASHES = Array.from({ length: 12 }, (_, index) => index);

// "17 Nov", or "17 Nov 2025" when not this year.
function formatParkedDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

// Text before the first comma: "Indiranagar, Bengaluru, …" → "Indiranagar".
function shortPlaceName(description: string) {
  const first = description.split(',')[0]?.trim();
  return first && first.length > 0 ? first : description;
}

function isRecentSearch(value: unknown): value is RecentSearch {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as RecentSearch).placeId === 'string' &&
    typeof (value as RecentSearch).description === 'string'
  );
}


export default function HomeScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [parkingSpots, setParkingSpots] = useState<ParkingSpot[]>([]);
  const [sponsored, setSponsored] = useState<SponsoredSpotData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedPlaceName, setSelectedPlaceName] =
    useState<string | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  // Parking near the user's current location.
  const [nearbyStatus, setNearbyStatus] = useState<NearbyStatus>('loading');
  const [nearbySpots, setNearbySpots] = useState<NearbySpot[]>([]);
  const [nearbySponsored, setNearbySponsored] =
    useState<SponsoredSpotData | null>(null);
  const [areaName, setAreaName] = useState<string | null>(null);
  const [cityName, setCityName] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [activeSession, setActiveSession] =
    useState<ParkingHistoryItem | null>(null);

  const { showDialog } = useDialog();
  const [parkAgainSpots, setParkAgainSpots] = useState<ParkAgainSpot[]>([]);
  const [openingSpotId, setOpeningSpotId] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);

  // First letter of the signed-in user's name or email, for the avatar.
  const profileInitial = useMemo(() => {
    const metadata = user?.user_metadata;
    const candidates: unknown[] = [
      metadata?.full_name,
      metadata?.name,
      user?.email,
    ];
    const value = candidates.find(
      (candidate): candidate is string =>
        typeof candidate === 'string' && candidate.trim().length > 0
    );

    return value ? value.trim().charAt(0).toUpperCase() : null;
  }, [user]);

  const loadActiveSession = useCallback(async () => {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) throw error;

      if (!session?.access_token) {
        setActiveSession(null);
        setParkAgainSpots([]);
        return;
      }

      const history = await getParkingHistory(session.access_token);

      const active = history.find(
        (item) => item.checked_out_at === null
      );

      setActiveSession(active ?? null);

      // Park again: distinct completed spots, most recent first (the API
      // returns history newest first).
      const seen = new Set<string>();
      const recentSpots: ParkAgainSpot[] = [];

      for (const item of history) {
        if (item.checked_out_at === null || !item.spot_id || seen.has(item.spot_id)) {
          continue;
        }

        seen.add(item.spot_id);
        recentSpots.push({
          spotId: item.spot_id,
          name: item.parking_spots?.name ?? 'Parking location',
          address: item.parking_spots?.address ?? null,
          lastParkedAt: item.checked_out_at,
        });

        if (recentSpots.length >= MAX_PARK_AGAIN) break;
      }

      setParkAgainSpots(recentSpots);
    } catch (error) {
      console.error('Could not load active parking session:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadActiveSession();
    }, [loadActiveSession])
  );

  // Recent searches: read once from the device.
  useEffect(() => {
    let isActive = true;

    AsyncStorage.getItem(RECENT_SEARCHES_KEY)
      .then((stored) => {
        if (!isActive || !stored) return;
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRecentSearches(
            parsed.filter(isRecentSearch).slice(0, MAX_RECENT_SEARCHES)
          );
        }
      })
      .catch((storageError) => {
        console.error('Could not load recent searches:', storageError);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const saveRecentSearches = (next: RecentSearch[]) => {
    AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next)).catch(
      (storageError) => {
        console.error('Could not save recent searches:', storageError);
      }
    );
  };

  const rememberSearch = (entry: RecentSearch) => {
    if (!entry.placeId || !entry.description) return;

    setRecentSearches((current) => {
      const next = [
        entry,
        ...current.filter((item) => item.placeId !== entry.placeId),
      ].slice(0, MAX_RECENT_SEARCHES);
      saveRecentSearches(next);
      return next;
    });
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    AsyncStorage.removeItem(RECENT_SEARCHES_KEY).catch((storageError) => {
      console.error('Could not clear recent searches:', storageError);
    });
  };

  // Loads parking around the device's position with the existing nearby
  // search API. Permission is only requested when `askPermission` is true.
  const loadNearby = useCallback(async (askPermission: boolean) => {
    setNearbyStatus('loading');

    try {
      let permission = await Location.getForegroundPermissionsAsync();

      if (!permission.granted && permission.canAskAgain && askPermission) {
        permission = await Location.requestForegroundPermissionsAsync();
      }

      if (!permission.granted) {
        setNearbyStatus(permission.canAskAgain ? 'denied' : 'blocked');
        return;
      }

      if (!(await Location.hasServicesEnabledAsync())) {
        setNearbyStatus('servicesOff');
        return;
      }

      const position =
        (await Location.getLastKnownPositionAsync({
          maxAge: LAST_KNOWN_MAX_AGE_MS,
        })) ??
        (await withTimeout(
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }),
          FRESH_FIX_TIMEOUT_MS
        ));

      const here = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      // Area name for the header; display only, failures are ignored.
      Location.reverseGeocodeAsync(here)
        .then(([address]) => {
          if (!address) return;
          setAreaName(
            address.district ?? address.subregion ?? address.city ?? null
          );
          setCityName(address.city ?? address.region ?? null);
        })
        .catch(() => {});

      const result = await searchNearbyParking(here.latitude, here.longitude);
      const spots = (result as { spots?: unknown })?.spots;

      if (!Array.isArray(spots)) {
        throw new Error('Invalid parking search response from server.');
      }

      const withDistance = (spots as ParkingSpot[])
        .map((spot) => ({
          ...spot,
          distance:
            Number.isFinite(spot.lat) && Number.isFinite(spot.lng)
              ? distanceMeters(here, { latitude: spot.lat, longitude: spot.lng })
              : null,
        }))
        .sort(
          (a, b) =>
            (a.distance ?? Number.POSITIVE_INFINITY) -
            (b.distance ?? Number.POSITIVE_INFINITY)
        );

      const sponsoredData = (result as { sponsored?: unknown })?.sponsored;

      setNearbySpots(withDistance);
      setNearbySponsored(
        sponsoredData != null ? (sponsoredData as SponsoredSpotData) : null
      );
      setNearbyStatus('ready');
    } catch (nearbyError) {
      console.error('Could not load nearby parking:', nearbyError);
      setNearbyStatus('error');
    }
  }, []);

  // Load once when Home first opens; pull to refresh reloads it.
  useEffect(() => {
    void loadNearby(true);
  }, [loadNearby]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadNearby(false), loadActiveSession()]);
    setRefreshing(false);
  };

  const handleAllowLocation = () => {
    if (nearbyStatus === 'blocked') {
      void Linking.openSettings();
      return;
    }

    void loadNearby(true);
  };

  const handleSearchByPlace = async (
    placeId: string,
    sessionToken: string
  ) => {
    try {
      setHasSearched(true);
      setLoading(true);
      setError(null);
      setParkingSpots([]);
      setSponsored(null);

      const { lat, lng } = await getPlaceDetails(
        placeId,
        sessionToken
      );

      const result = await searchNearbyParking(lat, lng);
      const spots = (result as { spots?: unknown })?.spots;

      if (Array.isArray(spots)) {
        setParkingSpots(spots as ParkingSpot[]);
        const sponsoredData = (result as { sponsored?: unknown })?.sponsored;
        setSponsored(
          sponsoredData != null
            ? (sponsoredData as SponsoredSpotData)
            : null
        );
      } else {
        console.error(
          'Unexpected parking search response:',
          result
        );

        throw new Error(
          'Invalid parking search response from server.'
        );
      }
    } catch (error) {
      console.error('Parking search error:', error);

      setError(
        error instanceof Error
          ? error.message
          : 'Something went wrong while searching for parking.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSuggestion = async (
    suggestion: Suggestion,
    sessionToken: string
  ) => {
    console.log(
      'Selected destination:',
      suggestion.description,
      suggestion.google_place_id
    );

    setSelectedPlaceName(suggestion.description);
    rememberSearch({
      placeId: suggestion.google_place_id,
      description: suggestion.description,
    });

    await handleSearchByPlace(
      suggestion.google_place_id,
      sessionToken
    );
  };

  const handleSelectDestination = async (
    destination: (typeof destinations)[number]
  ) => {
    const sessionToken = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;

    setSelectedPlaceName(destination.name);

    await handleSearchByPlace(
      destination.google_place_id,
      sessionToken
    );
  };

  const handleRecentSearch = async (entry: RecentSearch) => {
    if (loading) return;

    const sessionToken = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;

    setSelectedPlaceName(entry.description);
    rememberSearch(entry);

    await handleSearchByPlace(entry.placeId, sessionToken);
  };

  // Park again: load the spot's current details, then open Parking Details.
  const handleParkAgain = async (item: ParkAgainSpot) => {
    if (openingSpotId) return;

    setOpeningSpotId(item.spotId);

    try {
      const details = await getSpotAvailability(item.spotId);
      const verificationTier = VERIFICATION_TIERS.find(
        (tier) => tier === details.verification_tier
      );

      const spot: ParkingSpot = {
        id: details.id,
        google_place_id: details.google_place_id,
        name: details.name,
        address: details.address,
        lat: details.lat,
        lng: details.lng,
        price_per_hour: details.price_per_hour,
        source: details.source,
        verification_tier: verificationTier,
      };

      navigation.navigate('ParkingDetails', { spot });
    } catch (openError) {
      console.error('Could not open parking spot:', openError);
      showDialog({
        type: 'error',
        title: "Couldn't open this spot",
        message: 'Check your connection and try again.',
      });
    } finally {
      setOpeningSpotId(null);
    }
  };

  // "See all" shows the already-loaded nearby results in the results view.
  const handleSeeAllNearby = () => {
    setSelectedPlaceName(areaName ?? 'Your location');
    setParkingSpots(nearbySpots);
    setSponsored(nearbySponsored);
    setError(null);
    setLoading(false);
    setHasSearched(true);
  };

  // Return to the original Home screen without reloading the app.
  const handleBackToHome = () => {
    if (loading) return;

    setParkingSpots([]);
    setError(null);
    setHasSearched(false);
    setSponsored(null);
    setSelectedPlaceName(null);
  };

  // Shadow on the pinned search bar once content scrolls beneath it.
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrolled = event.nativeEvent.contentOffset.y > 40;
    setIsScrolled((current) => (current === scrolled ? current : scrolled));
  };

  const showResults = hasSearched;
  const resultCount = parkingSpots.length;

  const formatPrice = (price: number | null) =>
    price == null ? 'Price unavailable' : `₹${price}/hr`;

  // Ticket-stub card: details on top, a perforated tear line with side
  // notches, then a single row of facts.
  const renderTicket = ({
    key,
    top,
    bottom,
    onPress,
    accessibilityLabel,
    disabled,
  }: {
    key: string;
    top: ReactNode;
    bottom: ReactNode;
    onPress?: () => void;
    accessibilityLabel?: string;
    disabled?: boolean;
  }) => {
    const body = (
      <>
        <View style={styles.ticketTop}>{top}</View>
        <View style={styles.ticketTear} pointerEvents="none">
          {TICKET_DASHES.map((dash) => (
            <View key={dash} style={styles.ticketDash} />
          ))}
        </View>
        <View style={styles.ticketBottom}>{bottom}</View>
        <View
          style={[styles.ticketNotch, styles.ticketNotchLeft]}
          pointerEvents="none"
        />
        <View
          style={[styles.ticketNotch, styles.ticketNotchRight]}
          pointerEvents="none"
        />
      </>
    );

    if (!onPress) {
      return (
        <View key={key} style={styles.ticketCard}>
          {body}
        </View>
      );
    }

    return (
      <Pressable
        key={key}
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.ticketCard,
          pressed && styles.ticketCardPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: !!disabled }}
      >
        {body}
      </Pressable>
    );
  };

  const renderNearbyBody = () => {
    if (nearbyStatus === 'loading') {
      return (
        <ScrollView
          horizontal
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.nearbyRail}
          accessibilityLabel="Loading parking near you"
        >
          {[0, 1, 2].map((index) =>
            renderTicket({
              key: `skeleton-${index}`,
              top: (
                <>
                  <View style={[styles.skeletonLine, { width: '80%' }]} />
                  <View
                    style={[styles.skeletonLine, { width: '55%', marginTop: 10 }]}
                  />
                </>
              ),
              bottom: (
                <>
                  <View style={[styles.skeletonLine, { width: 44 }]} />
                  <View style={[styles.skeletonLine, { width: 52 }]} />
                </>
              ),
            })
          )}
        </ScrollView>
      );
    }

    if (
      nearbyStatus === 'denied' ||
      nearbyStatus === 'blocked' ||
      nearbyStatus === 'servicesOff' ||
      nearbyStatus === 'error'
    ) {
      const copy = {
        denied: {
          title: 'See parking around you',
          text: 'Allow location to get nearby recommendations.',
          action: 'Allow location',
        },
        blocked: {
          title: 'Location access is off',
          text: 'Turn it on in Settings to see parking near you.',
          action: 'Open settings',
        },
        servicesOff: {
          title: 'Location is turned off',
          text: 'Turn on location services, then try again.',
          action: 'Try again',
        },
        error: {
          title: "Couldn't load nearby parking",
          text: 'Check your connection and try again.',
          action: 'Retry',
        },
      }[nearbyStatus];

      return (
        <View style={styles.sectionBody}>
          <View style={[styles.listCard, styles.stateCard]}>
            <View style={styles.stateText}>
              <Text style={styles.stateTitle}>{copy.title}</Text>
              <Text style={styles.stateBody}>{copy.text}</Text>
            </View>
            <Pressable
              onPress={handleAllowLocation}
              style={({ pressed }) => [styles.stateAction, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={copy.action}
            >
              <Text style={styles.stateActionText}>{copy.action}</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    if (nearbySpots.length === 0) {
      return (
        <View style={styles.sectionBody}>
          <View style={[styles.listCard, styles.stateCard]}>
            <View style={styles.stateText}>
              <Text style={styles.stateTitle}>No parking found nearby</Text>
              <Text style={styles.stateBody}>
                Search a destination to see parking there.
              </Text>
            </View>
          </View>
        </View>
      );
    }

    const preview = nearbySpots.slice(0, NEARBY_PREVIEW_COUNT);

    return (
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={NEARBY_CARD_WIDTH + NEARBY_CARD_GAP}
        snapToAlignment="start"
        decelerationRate="fast"
        contentContainerStyle={styles.nearbyRail}
      >
        {preview.map((spot) => {
          const distanceText =
            spot.distance != null ? formatDistance(spot.distance) : null;
          const priceText =
            spot.price_per_hour == null ? null : formatPrice(spot.price_per_hour);

          return renderTicket({
            key: spot.google_place_id,
            onPress: () => navigation.navigate('ParkingDetails', { spot }),
            accessibilityLabel: [
              spot.name,
              distanceText ? `${distanceText} away` : null,
              priceText ?? 'Price not listed',
            ]
              .filter(Boolean)
              .join(', '),
            top: (
              <>
                <Text style={styles.nearbyName} numberOfLines={2}>
                  {spot.name}
                </Text>
                {!!spot.address && (
                  <Text style={styles.nearbyAddress} numberOfLines={1}>
                    {spot.address}
                  </Text>
                )}
              </>
            ),
            bottom: (
              <>
                <Text style={styles.nearbyDistance}>{distanceText ?? ''}</Text>
                <Text
                  style={priceText ? styles.nearbyPrice : styles.nearbyNoPrice}
                  numberOfLines={1}
                >
                  {priceText ?? 'Price not listed'}
                </Text>
              </>
            ),
          });
        })}
      </ScrollView>
    );
  };

  const renderParkAgain = () => {
    if (parkAgainSpots.length === 0) return null;

    return (
      <>
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Park again</Text>
        </View>

        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          snapToInterval={NEARBY_CARD_WIDTH + NEARBY_CARD_GAP}
          snapToAlignment="start"
          decelerationRate="fast"
          contentContainerStyle={styles.nearbyRail}
        >
          {parkAgainSpots.map((item) => {
            const parkedDate = formatParkedDate(item.lastParkedAt);
            const isOpening = openingSpotId === item.spotId;

            return renderTicket({
              key: item.spotId,
              onPress: () => void handleParkAgain(item),
              disabled: openingSpotId !== null,
              accessibilityLabel: [
                item.name,
                parkedDate ? `last parked ${parkedDate}` : null,
              ]
                .filter(Boolean)
                .join(', '),
              top: (
                <>
                  <Text style={styles.nearbyName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  {!!item.address && (
                    <Text style={styles.nearbyAddress} numberOfLines={1}>
                      {item.address}
                    </Text>
                  )}
                </>
              ),
              bottom: (
                <>
                  <Text style={styles.nearbyDistance} numberOfLines={1}>
                    {parkedDate ? `Parked ${parkedDate}` : 'Parked before'}
                  </Text>
                  {isOpening && (
                    <ActivityIndicator size="small" color={colors.primary} />
                  )}
                </>
              ),
            });
          })}
        </ScrollView>
      </>
    );
  };

  const renderRecentSearches = () => {
    if (recentSearches.length === 0) return null;

    return (
      <>
        <View style={[styles.sectionHeading, styles.recentHeading]}>
          <Text style={styles.recentTitle}>Recent searches</Text>
          <Pressable
            onPress={clearRecentSearches}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear recent searches"
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text style={styles.seeAllText}>Clear</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.recentRail}
        >
          {recentSearches.map((entry) => (
            <Pressable
              key={entry.placeId}
              onPress={() => void handleRecentSearch(entry)}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={`Search parking near ${entry.description}`}
              style={({ pressed }) => [
                styles.recentChip,
                pressed && styles.recentChipPressed,
              ]}
            >
              <Text style={styles.recentChipText} numberOfLines={1}>
                {shortPlaceName(entry.description)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </>
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: activeSession
              ? ACTIVE_BUBBLE_CLEARANCE
              : spacing.lg,
          },
        ]}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={showResults ? undefined : [1]}
        onScroll={handleScroll}
        scrollEventThrottle={32}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          showResults ? undefined : (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void handleRefresh()}
              tintColor={colors.primary}
              colors={[colors.primary]}
              progressBackgroundColor={colors.surface}
            />
          )
        }
      >
        {!showResults && (
          <View style={styles.header}>
            <View style={styles.headerText}>
              <View style={styles.locationRow}>
                <Ionicons name="location" size={18} color={colors.primary} />
                <Text style={styles.areaText} numberOfLines={1}>
                  {areaName ??
                    (nearbyStatus === 'loading' ? 'Locating…' : 'Bengaluru')}
                </Text>
              </View>
              <Text style={styles.cityText} numberOfLines={1}>
                {areaName ? cityName ?? 'Bengaluru' : 'Find parking near you'}
              </Text>
            </View>

            <Pressable
              onPress={() => navigation.navigate('Profile')}
              style={({ pressed }) => [
                styles.avatar,
                pressed && styles.avatarPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Profile"
              hitSlop={6}
            >
              {profileInitial ? (
                <Text style={styles.avatarInitial}>
                  {profileInitial}
                </Text>
              ) : (
                <Ionicons
                  name="person"
                  size={20}
                  color={colors.goldDeep}
                />
              )}
            </Pressable>
          </View>
        )}

        {!showResults && (
          <View
            style={[
              styles.stickySearch,
              isScrolled && styles.stickySearchRaised,
            ]}
          >
            <SearchBar onSelectSuggestion={handleSelectSuggestion} />
          </View>
        )}

        {!showResults && (
          <View>
            {renderRecentSearches()}

            {/* Parking near you */}
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>Parking near you</Text>
              {nearbyStatus === 'ready' &&
                nearbySpots.length > NEARBY_PREVIEW_COUNT && (
                  <Pressable
                    onPress={handleSeeAllNearby}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="See all parking near you"
                    style={({ pressed }) => [styles.seeAll, pressed && styles.pressed]}
                  >
                    <Text style={styles.seeAllText}>
                      See all
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={14}
                      color={colors.primaryDeep}
                    />
                  </Pressable>
                )}
            </View>

            {renderNearbyBody()}

            {renderParkAgain()}

            {/* Popular destinations */}
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>Popular in Bengaluru</Text>
            </View>

            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              snapToInterval={DESTINATION_CARD_WIDTH + DESTINATION_CARD_GAP}
              snapToAlignment="start"
              decelerationRate="fast"
              contentContainerStyle={styles.carouselContent}
            >
              {destinations.map((destination) => (
                <Pressable
                  key={destination.number}
                  onPress={() => handleSelectDestination(destination)}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel={`Find parking near ${destination.name}`}
                  style={({ pressed }) => [
                    styles.destinationCard,
                    pressed && styles.destinationCardPressed,
                  ]}
                >
                  <Image
                    source={destination.image}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={250}
                  />

                  <LinearGradient
                    colors={[
                      'rgba(31,27,20,0)',
                      'rgba(31,27,20,0.75)',
                    ]}
                    locations={[0.35, 1]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    pointerEvents="none"
                    style={StyleSheet.absoluteFill}
                  />

                  <View style={styles.destinationText}>
                    <Text
                      style={styles.destinationName}
                      numberOfLines={2}
                    >
                      {destination.name}
                    </Text>
                    <Text
                      style={styles.destinationArea}
                      numberOfLines={1}
                    >
                      {destination.area}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>

            {/* Quiet brand sign-off */}
            <View style={[styles.footer, { opacity: isDark ? 0.55 : 0.7 }]}>
              <CitySkyline height={96} />
              <Text style={styles.footerBrand}>ParkCity</Text>
              <Text style={styles.footerTagline}>
                INTELLIGENCE IN EVERY SPACE
              </Text>
            </View>
          </View>
        )}

        {showResults && (
          <View style={[styles.resultsSection, { paddingTop: spacing.sm }]}>
            <View style={styles.resultsHeader}>
              <Pressable
                onPress={handleBackToHome}
                disabled={loading}
                style={({ pressed }) => [
                  styles.backButton,
                  pressed && styles.backButtonPressed,
                  loading && styles.backButtonDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Back to Home"
                hitSlop={8}
              >
                <Ionicons
                  name="arrow-back"
                  size={20}
                  color={colors.text}
                />
              </Pressable>

              <View style={styles.resultsTitleGroup}>
                <Text style={styles.resultsOverline}>PARKING NEAR</Text>
                <Text style={styles.resultsTitle} numberOfLines={2}>
                  {selectedPlaceName ?? 'Your destination'}
                </Text>
              </View>
            </View>

            {!loading && !error && resultCount > 0 && (
              <Text style={styles.resultsCount}>
                {resultCount} {resultCount === 1 ? 'spot' : 'spots'} found
              </Text>
            )}

            {loading && (
              <View style={styles.loadingState}>
                <Text style={styles.stateTextMuted}>
                  Finding parking for you...
                </Text>
                <SkeletonCard variant="photo" />
                <SkeletonCard variant="photo" />
                <SkeletonCard variant="photo" />
              </View>
            )}

            {!!error && (
              <View style={styles.errorCard}>
                <Ionicons
                  name="alert-circle"
                  size={20}
                  color={colors.errorStrong}
                />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {!loading &&
              !error &&
              parkingSpots.length === 0 && (
                <EmptyState
                  icon="car-outline"
                  heading="No parking found"
                  subtext="No parking options found for this destination."
                />
              )}

            {!loading && !error && sponsored && (
              <SponsoredCard
                spot={sponsored}
                onPress={() =>
                  navigation.navigate('SpotDetail', { spotId: sponsored.id })
                }
              />
            )}

            {!loading &&
              !error &&
              parkingSpots.map((spot) => (
                <ParkingSpotCard
                  key={spot.google_place_id}
                  spot={spot}
                  navigation={navigation}
                />
              ))}
          </View>
        )}
      </ScrollView>

      {activeSession && (
        <Pressable
          onPress={() =>
            navigation.navigate('ActiveParking', {
              session: activeSession,
            })
          }
          style={({ pressed }) => [
            styles.activeBubble,
            pressed && styles.activeBubblePressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="View your active parking session"
        >
          <View style={styles.activeIcon}>
            <Ionicons name="car" size={20} color={colors.primary} />
          </View>

          <View style={styles.activeContent}>
            <View style={styles.activeStatusRow}>
              <View style={styles.activeDot} />
              <Text style={styles.activeOverline}>CURRENTLY PARKED</Text>
            </View>

            <Text style={styles.activeName} numberOfLines={1}>
              {activeSession.parking_spots?.name ?? 'Parking location'}
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.textSecondary}
          />
        </Pressable>
      )}
    </View>
  );
}

const createStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },

    scrollView: {
      flex: 1,
    },

    content: {
      flexGrow: 1,
    },

    pressed: {
      opacity: 0.7,
    },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
    },

    headerText: {
      flex: 1,
      minWidth: 0,
    },

    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },

    areaText: {
      flexShrink: 1,
      color: colors.text,
      fontSize: 20,
      lineHeight: 26,
      fontWeight: fontWeight.bold,
      letterSpacing: letterSpacing.snug,
    },

    cityText: {
      color: colors.textSecondary,
      fontSize: typography.small - 1,
      lineHeight: 18,
      marginTop: 1,
      marginLeft: 22,
    },

    avatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.champagneSoft,
      borderWidth: 1,
      borderColor: colors.champagne,
      alignItems: 'center',
      justifyContent: 'center',
    },

    avatarPressed: {
      opacity: 0.75,
      transform: [{ scale: 0.96 }],
    },

    avatarInitial: {
      color: colors.goldDeep,
      fontSize: 16,
      fontWeight: fontWeight.bold,
    },

    // Pinned search
    stickySearch: {
      paddingHorizontal: spacing.lg,
      paddingTop: 12,
      paddingBottom: 12,
      backgroundColor: colors.background,
      zIndex: 10,
    },

    stickySearchRaised: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      ...shadow.sm,
    },

    // Sections
    sectionHeading: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      marginTop: spacing.lg,
      marginBottom: 10,
    },

    sectionTitle: {
      color: colors.text,
      fontSize: 17,
      lineHeight: 22,
      fontWeight: fontWeight.bold,
      letterSpacing: letterSpacing.snug,
    },

    sectionBody: {
      paddingHorizontal: spacing.lg,
    },

    seeAll: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },

    seeAllText: {
      color: colors.primaryDeep,
      fontSize: 13,
      fontWeight: fontWeight.semibold,
    },

    // Nearby list
    listCard: {
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },

    // Nearby: horizontal cards
    nearbyRail: {
      paddingHorizontal: spacing.lg,
      gap: NEARBY_CARD_GAP,
    },

    // Ticket card
    ticketCard: {
      width: NEARBY_CARD_WIDTH,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },

    ticketCardPressed: {
      backgroundColor: colors.surfaceMuted,
    },

    ticketTop: {
      height: TICKET_TOP_HEIGHT,
      paddingHorizontal: 14,
      paddingTop: 14,
    },

    ticketTear: {
      height: TICKET_TEAR_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: TICKET_NOTCH_SIZE / 2 + 6,
    },

    ticketDash: {
      flex: 1,
      height: 1.5,
      marginHorizontal: 2,
      borderRadius: 1,
      backgroundColor: colors.borderStrong,
    },

    ticketNotch: {
      position: 'absolute',
      top: TICKET_TOP_HEIGHT + (TICKET_TEAR_HEIGHT - TICKET_NOTCH_SIZE) / 2,
      width: TICKET_NOTCH_SIZE,
      height: TICKET_NOTCH_SIZE,
      borderRadius: TICKET_NOTCH_SIZE / 2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },

    ticketNotchLeft: {
      left: -TICKET_NOTCH_SIZE / 2,
    },

    ticketNotchRight: {
      right: -TICKET_NOTCH_SIZE / 2,
    },

    ticketBottom: {
      minHeight: 40,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      paddingHorizontal: 14,
      paddingBottom: 12,
    },

    // Recent searches
    recentHeading: {
      marginTop: spacing.md,
      marginBottom: 8,
    },

    recentTitle: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: fontWeight.semibold,
    },

    recentRail: {
      paddingHorizontal: spacing.lg,
      gap: 8,
    },

    recentChip: {
      maxWidth: 180,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
    },

    recentChipPressed: {
      backgroundColor: colors.surfaceMuted,
    },

    recentChipText: {
      color: colors.text,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: fontWeight.medium,
    },

    nearbyName: {
      color: colors.text,
      fontSize: 15,
      lineHeight: 20,
      fontWeight: fontWeight.semibold,
    },

    nearbyAddress: {
      color: colors.textSecondary,
      fontSize: typography.caption + 0.5,
      lineHeight: 17,
      marginTop: 3,
    },


    nearbyDistance: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 17,
    },

    nearbyPrice: {
      color: colors.text,
      fontSize: 13,
      lineHeight: 17,
      fontWeight: fontWeight.semibold,
    },

    nearbyNoPrice: {
      flexShrink: 1,
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 17,
    },

    skeletonLine: {
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.skeleton,
    },

    // Nearby states
    stateCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
    },

    stateText: {
      flex: 1,
      minWidth: 0,
    },

    stateTitle: {
      color: colors.text,
      fontSize: 14.5,
      lineHeight: 19,
      fontWeight: fontWeight.semibold,
    },

    stateBody: {
      color: colors.textSecondary,
      fontSize: typography.caption + 0.5,
      lineHeight: 17,
      marginTop: 2,
    },

    stateAction: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: radius.pill,
      backgroundColor: colors.primarySoft,
    },

    stateActionText: {
      color: colors.primaryDeep,
      fontSize: 12.5,
      fontWeight: fontWeight.semibold,
    },

    // Destinations
    carouselContent: {
      paddingHorizontal: spacing.lg,
      gap: DESTINATION_CARD_GAP,
    },

    destinationCard: {
      width: DESTINATION_CARD_WIDTH,
      height: 128,
      borderRadius: radius.lg,
      overflow: 'hidden',
      backgroundColor: colors.destinationSurface,
      justifyContent: 'flex-end',
    },

    destinationCardPressed: {
      transform: [{ scale: 0.97 }],
    },

    destinationText: {
      paddingHorizontal: 12,
      paddingBottom: 10,
    },

    destinationName: {
      color: lightColors.white,
      fontSize: 15,
      lineHeight: 19,
      fontWeight: fontWeight.bold,
      letterSpacing: letterSpacing.snug,
    },

    destinationArea: {
      color: lightColors.overlayText,
      fontSize: typography.caption,
      lineHeight: typography.captionLineHeight,
      marginTop: 2,
    },

    // Footer
    footer: {
      alignItems: 'center',
      marginTop: spacing.xl,
      paddingHorizontal: spacing.md,
    },

    footerBrand: {
      color: colors.textSecondary,
      fontSize: 18,
      fontWeight: fontWeight.bold,
      letterSpacing: 4,
      marginTop: spacing.sm,
    },

    footerTagline: {
      color: colors.textSecondary,
      fontSize: 9.5,
      fontWeight: fontWeight.semibold,
      letterSpacing: letterSpacing.overline,
      marginTop: 3,
    },

    // Results
    resultsSection: {
      paddingHorizontal: spacing.lg,
    },

    resultsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.sm,
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
      ...shadow.sm,
    },

    backButtonPressed: {
      opacity: 0.75,
    },

    backButtonDisabled: {
      opacity: 0.5,
    },

    resultsTitleGroup: {
      flex: 1,
      minWidth: 0,
    },

    resultsOverline: {
      color: colors.goldDeep,
      fontSize: typography.overline,
      lineHeight: typography.overlineLineHeight,
      fontWeight: fontWeight.bold,
      letterSpacing: letterSpacing.overline,
    },

    resultsTitle: {
      color: colors.text,
      fontSize: 22,
      lineHeight: 28,
      fontWeight: fontWeight.bold,
      letterSpacing: letterSpacing.snug,
      marginTop: 2,
    },

    resultsCount: {
      color: colors.textSecondary,
      fontSize: typography.small,
      lineHeight: typography.smallLineHeight,
      marginTop: spacing.xs,
      marginBottom: spacing.md,
    },

    loadingState: {
      gap: spacing.sm,
      paddingTop: spacing.md,
    },

    stateTextMuted: {
      color: colors.textSecondary,
      fontSize: typography.small,
      lineHeight: typography.smallLineHeight,
      marginBottom: spacing.sm,
    },

    errorCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.errorSoft,
    },

    errorText: {
      flex: 1,
      color: colors.text,
      fontSize: typography.small,
      lineHeight: typography.smallLineHeight,
    },

    // Currently parked bubble
    activeBubble: {
      position: 'absolute',
      bottom: 12,
      left: spacing.lg,
      right: spacing.lg,
      minHeight: 72,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      borderRadius: radius.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primarySoft,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      zIndex: 20,
      ...shadow.lg,
    },

    activeBubblePressed: {
      opacity: 0.85,
      transform: [{ scale: 0.98 }],
    },

    activeIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },

    activeContent: {
      flex: 1,
      gap: 3,
    },

    activeStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },

    activeDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.primary,
    },

    activeOverline: {
      color: colors.primaryDeep,
      fontSize: typography.overline,
      lineHeight: typography.overlineLineHeight,
      fontWeight: fontWeight.bold,
      letterSpacing: letterSpacing.overline,
    },

    activeName: {
      color: colors.text,
      fontSize: 15,
      lineHeight: 20,
      fontWeight: fontWeight.semibold,
    },
  });
