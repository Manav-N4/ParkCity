import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import ParkingSpotCard from '../components/ParkingSpotCard';
import SearchBar, { Suggestion } from '../components/SearchBar';
import {
  colors,
  fontWeight,
  spacing,
  typography,
} from '../constants/tokens';
import {
  getPlaceDetails,
  searchNearbyParking,
} from '../lib/api';
import { ParkingSpot } from '../types/parking';

export default function HomeScreen() {
  const [parkingSpots, setParkingSpots] = useState<ParkingSpot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectSuggestion = async (
    suggestion: Suggestion,
    sessionToken: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      setParkingSpots([]);

      const { lat, lng } = await getPlaceDetails(
        suggestion.google_place_id,
        sessionToken
      );

      const spots = await searchNearbyParking(lat, lng);

      setParkingSpots(spots);
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

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Where are you going?</Text>

      <SearchBar
        onSelectSuggestion={handleSelectSuggestion}
      />

      <Text style={styles.sectionTitle}>Nearby parking</Text>

      {loading && (
        <ActivityIndicator
          size="small"
          color={colors.primary}
        />
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      {!loading && !error && (
        <FlatList
          data={parkingSpots}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ParkingSpotCard spot={item} />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.md,
  },

  heading: {
    color: colors.text,
    fontSize: typography.heading,
    lineHeight: typography.headingLineHeight,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.md,
  },

  sectionTitle: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.md,
  },

  listContent: {
    paddingBottom: spacing.xl,
  },

  error: {
    color: colors.error,
    fontSize: typography.small,
    lineHeight: typography.smallLineHeight,
  },
});