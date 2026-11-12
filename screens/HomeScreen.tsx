
import { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  useFocusEffect,
  type CompositeScreenProps,
} from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../App';
import type { MainTabParamList } from '../navigation/MainTabNavigator';
import ParkingSpotCard from '../components/ParkingSpotCard';
import SearchBar, { Suggestion } from '../components/ui/SearchBar';
import SkeletonCard from '../components/ui/SkeletonCard';
import {
  colors,
  fontWeight,
  spacing,
  typography,
} from '../constants/tokens';
import {
  getPlaceDetails,
  searchNearbyParking,
  getParkingHistory,
  type ParkingHistoryItem,
} from '../lib/api';
import { supabase } from '../lib/supabase';
import { ParkingSpot } from '../types/parking';

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
    image: require('../assets/destinations/lalbagh-fixed.jpg'),
    size: 'large',
  },
  {
    number: '02',
    name: 'Kempegowda International Airport',
    area: 'Devanahalli',
    google_place_id: 'ChIJZWJEdf4crjsRjkEpoelwbCk',
    image: require('../assets/destinations/airport.jpg'),
    size: 'small',
  },
  {
    number: '03',
    name: 'Vidhana Soudha',
    area: 'Central Bengaluru',
    google_place_id: 'ChIJt-j-2G0WrjsRU5RX3HUnEaM',
    image: require('../assets/destinations/Vidhana-Soudha.jpg'),
    size: 'small',
  },
] as const;

export default function HomeScreen({ navigation }: Props) {
  const [parkingSpots, setParkingSpots] = useState<ParkingSpot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const [activeSession, setActiveSession] =
    useState<ParkingHistoryItem | null>(null);

  const loadActiveSession = useCallback(async () => {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) throw error;

      if (!session?.access_token) {
        setActiveSession(null);
        return;
      }

      const history = await getParkingHistory(session.access_token);

      const active = history.find(
        (item) => item.checked_out_at === null
      );

      setActiveSession(active ?? null);
    } catch (error) {
      console.error('Could not load active parking session:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadActiveSession();
    }, [loadActiveSession])
  );

  const handleSearchByPlace = async (
    placeId: string,
    sessionToken: string
  ) => {
    try {
      setHasSearched(true);
      setLoading(true);
      setError(null);
      setParkingSpots([]);

      const { lat, lng } = await getPlaceDetails(
        placeId,
        sessionToken
      );

      const result = await searchNearbyParking(lat, lng);
      const spots = (result as { spots?: unknown })?.spots;

      if (Array.isArray(spots)) {
        setParkingSpots(spots as ParkingSpot[]);
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

    await handleSearchByPlace(
      destination.google_place_id,
      sessionToken
    );
  };

  // Return to the original Home screen without reloading the app.
  const handleBackToHome = () => {
    if (loading) return;

    setParkingSpots([]);
    setError(null);
    setHasSearched(false);
  };

  const showResults = hasSearched;

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {!showResults && (
          <>
            <View style={styles.topSearchRow}>
              <View style={styles.searchBarContainer}>
                <SearchBar onSelectSuggestion={handleSelectSuggestion} />
              </View>

              <Pressable
                onPress={() => navigation.navigate('Profile')}
                style={({ pressed }) => [
                  styles.profileButton,
                  pressed && styles.profileButtonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Profile"
              >
                <Text style={styles.profileInitial}>A</Text>
              </Pressable>
            </View>

            <View style={styles.destinationsSection}>
              <View style={styles.sectionHeading}>
                <View style={styles.sectionTitleGroup}>
                  <Text style={styles.sectionTitle}>
                    Popular in Bengaluru
                  </Text>
                  <Text style={styles.sectionSubtitle}>
                    Find your next destination.
                  </Text>
                </View>
                <Text style={styles.cityLabel}>BLR</Text>
              </View>

              <View style={styles.destinationList}>
                {destinations.map((destination) => (
                  <Pressable
                    key={destination.number}
                    onPress={() => handleSelectDestination(destination)}
                    disabled={loading}
                    style={({ pressed }) => [
                      styles.destinationCard,
                      destination.size === 'large'
                        ? styles.destinationLarge
                        : styles.destinationSmall,
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
                        'rgba(10,18,14,0.02)',
                        'rgba(10,18,14,0.18)',
                        'rgba(10,18,14,0.94)',
                      ]}
                      locations={[0.15, 0.5, 1]}
                      start={{ x: 0.5, y: 0 }}
                      end={{ x: 0.5, y: 1 }}
                      pointerEvents="none"
                      style={StyleSheet.absoluteFill}
                    />

                    <View style={styles.destinationNumber}>
                      <Text style={styles.destinationNumberText}>
                        {destination.number}
                      </Text>
                    </View>

                    <View style={styles.destinationBottom}>
                      <Text
                        style={styles.destinationName}
                        numberOfLines={2}
                      >
                        {destination.name}
                      </Text>
                      <Text style={styles.destinationArea}>
                        {destination.area}
                      </Text>
                    </View>

                    <View style={styles.destinationArrow}>
                      <Text style={styles.destinationArrowText}>↗</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          </>
        )}

        {showResults && (
          <View style={styles.resultsSection}>
            <Pressable
              onPress={handleBackToHome}
              disabled={loading}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Back to Home"
            >
              <Text style={styles.backButtonText}>←</Text>
              <Text style={styles.backButtonLabel}>
                Back to Home
              </Text>
            </Pressable>

            <Text style={styles.resultsTitle}>
              Parking near your destination
            </Text>

            {loading && (
              <View style={styles.loadingState}>
                <Text style={styles.stateText}>
                  Finding parking for you...
                </Text>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </View>
            )}

            {!!error && (
              <Text style={styles.errorText}>{error}</Text>
            )}

            {!loading &&
              !error &&
              parkingSpots.length === 0 && (
                <Text style={styles.stateText}>
                  No parking options found for this destination.
                </Text>
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
            styles.activeParkingBubble,
            pressed && styles.activeParkingBubblePressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="View your active parking session"
        >
          <View style={styles.activeParkingIndicator} />

          <View style={styles.activeParkingBubbleContent}>
            <Text style={styles.activeParkingBubbleTitle}>
              CURRENTLY PARKED
            </Text>

            <Text
              style={styles.activeParkingBubbleName}
              numberOfLines={1}
            >
              {activeSession.parking_spots?.name ?? 'Parking location'}
            </Text>
          </View>

          <Text style={styles.activeParkingArrow}>↗</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  scrollView: {
    flex: 1,
  },

  content: {
    paddingTop: 58,
    paddingBottom: 110,
  },

  header: {
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },

  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  brandMark: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  brandMarkText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: fontWeight.bold,
  },

  brandName: {
    color: colors.text,
    fontSize: 29,
    lineHeight: 32,
    fontWeight: fontWeight.semibold,
    letterSpacing: -1.2,
  },

  brandTagline: {
    color: colors.textSecondary,
    fontSize: 9,
    letterSpacing: 1.4,
    marginTop: 3,
  },

  topSearchRow: {
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    zIndex: 5,
  },

  searchBarContainer: {
    flex: 1,
    minWidth: 0,
  },

  destinationCardPressed: {
    transform: [{ scale: 0.985 }],
  },

  profileButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F2F3EF',
    borderWidth: 1,
    borderColor: '#E1E4DD',
    alignItems: 'center',
    justifyContent: 'center',
  },

  profileButtonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.96 }],
  },

  profileInitial: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: fontWeight.semibold,
  },

  hero: {
    height: 410,
    marginTop: 8,
    position: 'relative',
    overflow: 'hidden',
  },

  heroImage: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: '100%',
    height: '100%',
  },

  heroHorizontalFade: {
    ...StyleSheet.absoluteFill,
  },

  heroBottomFade: {
    ...StyleSheet.absoluteFill,
  },

  heroCopy: {
    paddingLeft: spacing.lg,
    paddingTop: 44,
    paddingRight: 20,
  },

  eyebrow: {
    color: colors.primary,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: fontWeight.semibold,
    marginBottom: 18,
  },

  heroTitle: {
    color: colors.text,
    fontSize: 43,
    lineHeight: 47,
    fontWeight: fontWeight.bold,
    letterSpacing: -1.8,
  },

  heroAccent: {
    color: colors.primary,
    fontSize: 43,
    lineHeight: 48,
    fontWeight: fontWeight.bold,
    letterSpacing: -1.8,
  },

  heroSubtitle: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 23,
    marginTop: 13,
  },

  searchSection: {
    paddingHorizontal: spacing.lg,
    marginTop: -14,
    zIndex: 5,
  },

  activeParkingCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  activeParkingCardPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },

  activeParkingTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },

  activeParkingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  activeParkingIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#27965C',
  },

  activeParkingEyebrow: {
    color: '#27965C',
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: fontWeight.bold,
  },

  activeParkingArrow: {
    color: colors.primary,
    fontSize: 21,
    lineHeight: 24,
  },

  activeParkingName: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: fontWeight.bold,
  },

  activeParkingAddress: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },

  activeParkingAction: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: fontWeight.semibold,
    marginTop: spacing.md,
  },

  activeParkingBubble: {
    position: 'absolute',
    bottom: 12,
    left: spacing.lg,
    right: spacing.lg,
    minHeight: 72,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    zIndex: 20,
  },

  activeParkingBubblePressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },

  activeParkingBubbleContent: {
    flex: 1,
    gap: 4,
  },

  activeParkingBubbleTitle: {
    color: '#27965C',
    fontSize: 9,
    letterSpacing: 1.1,
    fontWeight: fontWeight.bold,
  },

  activeParkingBubbleName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: fontWeight.semibold,
  },

  destinationsSection: {
    marginTop: 36,
    paddingHorizontal: spacing.lg,
  },

  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },

  sectionTitleGroup: {
    flex: 1,
    gap: 4,
  },

  sectionTitle: {
    color: colors.text,
    fontSize: 23,
    lineHeight: 29,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.7,
  },

  sectionSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },

  cityLabel: {
    color: colors.primary,
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: fontWeight.semibold,
    marginLeft: 12,
  },

  destinationList: {
    gap: 14,
  },

  destinationCard: {
    overflow: 'hidden',
    borderRadius: 28,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    backgroundColor: '#D9E0D7',
    justifyContent: 'flex-end',
  },

  destinationLarge: {
    height: 230,
  },

  destinationSmall: {
    height: 190,
  },

  destinationNumber: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: 'rgba(10,18,14,0.48)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },

  destinationNumberText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: fontWeight.medium,
  },

  destinationBottom: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 15,
    paddingRight: 66,
  },

  destinationName: {
    color: '#FFFFFF',
    fontSize: 23,
    lineHeight: 28,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.4,
  },

  destinationArea: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 13,
    marginTop: 3,
  },

  destinationArrow: {
    position: 'absolute',
    right: 12,
    bottom: 15,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  destinationArrowText: {
    color: '#FFFFFF',
    fontSize: 25,
    lineHeight: 29,
  },

  footerBanner: {
    marginHorizontal: spacing.lg,
    marginTop: 24,
    padding: 20,
    borderRadius: 22,
    backgroundColor: '#E5E9D9',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },

  footerMark: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  footerMarkText: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: fontWeight.bold,
  },

  footerCopy: {
    flex: 1,
    gap: 5,
  },

  footerTitle: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: fontWeight.bold,
  },

  footerSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },

  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },

  backButtonText: {
    color: colors.primary,
    fontSize: 24,
    lineHeight: 28,
  },

  backButtonLabel: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: fontWeight.semibold,
  },

  resultsSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },

  resultsTitle: {
    color: colors.text,
    fontSize: typography.heading,
    lineHeight: typography.headingLineHeight,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.lg,
  },

  loadingState: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },

  stateText: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },

  errorText: {
    color: colors.error,
    fontSize: typography.small,
    lineHeight: typography.smallLineHeight,
  },
});
