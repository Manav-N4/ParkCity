import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import ParkingSpotCard from '../components/ParkingSpotCard';
import {
  colors,
  fontWeight,
  radius,
  size,
  spacing,
  typography,
} from '../constants/tokens';
import { supabase } from '../lib/supabase';
import { ParkingSpot } from '../types/parking';

export default function HomeScreen() {
  const [parkingSpots, setParkingSpots] = useState<ParkingSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNearbyParking = async () => {
      const rpcParams = {
        user_lng: 77.6189,
        user_lat: 12.9341,
        radius_meters: 2000,
      };


      const { data, error } = await supabase.rpc(
        'nearby_parking_spots',
        rpcParams
      );

      if (error) {
        console.log('RPC ERROR:', error);
        setError(error.message);
        setLoading(false);
        return;
      }

      setParkingSpots(data ?? []);
      setLoading(false);
    };

    fetchNearbyParking();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Where are you going?</Text>

      <TextInput
        style={styles.searchInput}
        placeholder="Search a destination"
        placeholderTextColor={colors.textSecondary}
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
        <>
          <FlatList
            data={parkingSpots}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <ParkingSpotCard spot={item} />}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
        </>
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

  searchInput: {
    height: size.inputHeight,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: typography.body,
    marginBottom: spacing.xl,
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

  debugText: {
    color: colors.textSecondary,
    fontSize: typography.small,
    marginBottom: spacing.md,
  },
});