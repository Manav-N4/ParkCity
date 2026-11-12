
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type {
  NativeStackScreenProps,
  NativeStackNavigationProp,
} from '@react-navigation/native-stack';

import type { RootStackParamList } from '../App';
import type { MainTabParamList } from '../navigation/MainTabNavigator';
import type { ParkingSpot } from '../types/parking';
import type { SavedSpot } from '../lib/api';

import { getSavedSpots, toggleSavedSpot } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { spacing, fontWeight } from '../constants/tokens';

import ParkingSpotCard from '../components/ParkingSpotCard';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Saved'>,
  NativeStackScreenProps<RootStackParamList>
>;

export default function SavedScreen({ navigation }: Props) {
  const { colors } = useTheme();

  const [savedSpots, setSavedSpots] = useState<SavedSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSavedSpots = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!session) {
        setIsSignedIn(false);
        setAccessToken(null);
        setSavedSpots([]);
        return;
      }

      setIsSignedIn(true);
      setAccessToken(session.access_token);

      const spots = await getSavedSpots(session.access_token);
      setSavedSpots(spots);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load saved parking spots.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSavedSpots();
    }, [loadSavedSpots]),
  );

  const handleRemove = async (spot: SavedSpot) => {
    if (!accessToken || removingId) return;

    setRemovingId(spot.id);

    try {
      await toggleSavedSpot(accessToken, spot.id, 'unsave');

      setSavedSpots((previous) =>
        previous.filter((item) => item.id !== spot.id),
      );
    } catch (err) {
      Alert.alert(
        'Unable to remove spot',
        err instanceof Error
          ? err.message
          : 'Please try again.',
      );
    } finally {
      setRemovingId(null);
    }
  };

  const handleCardSavedChange = (
    spotId: string,
    isSaved: boolean,
  ) => {
    if (!isSaved) {
      setSavedSpots((previous) =>
        previous.filter((item) => item.id !== spotId),
      );
    }
  };

  const convertToParkingSpot = (spot: SavedSpot): ParkingSpot => ({
    id: spot.id,
    google_place_id: spot.google_place_id,
    name: spot.name,
    lat: spot.lat,
    lng: spot.lng,
    price_per_hour: spot.price_per_hour,
    source: spot.source,
  });

  const renderRightActions = (spot: SavedSpot) => (
    <Pressable
      onPress={() => handleRemove(spot)}
      disabled={removingId !== null}
      accessibilityRole="button"
      accessibilityLabel={`Remove ${spot.name} from saved spots`}
      style={[
        styles.removeAction,
        { backgroundColor: colors.error },
      ]}
    >
      <Text style={styles.removeActionText}>
        {removingId === spot.id ? 'Removing...' : 'Remove'}
      </Text>
    </Pressable>
  );

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>
          Saved Spots
        </Text>

        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Your favourite parking locations.
        </Text>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator
            size="large"
            color={colors.primary}
          />
          <Text style={[styles.stateText, { color: colors.textSecondary }]}>
            Loading saved spots...
          </Text>
        </View>
      ) : !isSignedIn ? (
        <View style={styles.centerState}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Sign in to save spots
          </Text>

          <Text style={[styles.stateText, { color: colors.textSecondary }]}>
            Sign in to view and manage your saved parking locations.
          </Text>

          <Pressable
            onPress={() =>
              navigation
                .getParent<NativeStackNavigationProp<RootStackParamList>>()
                ?.navigate('EmailLogin', {})
            }
            style={[
              styles.signInButton,
              { backgroundColor: colors.primary },
            ]}
          >
            <Text style={styles.signInButtonText}>
              Sign in
            </Text>
          </Pressable>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Couldn't load saved spots
          </Text>

          <Text style={[styles.stateText, { color: colors.textSecondary }]}>
            {error}
          </Text>

          <Pressable
            onPress={() => void loadSavedSpots()}
            style={[
              styles.signInButton,
              { backgroundColor: colors.primary },
            ]}
          >
            <Text style={styles.signInButtonText}>
              Try again
            </Text>
          </Pressable>
        </View>
      ) : savedSpots.length === 0 ? (
        <View style={styles.centerState}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No saved spots yet — start exploring
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {savedSpots.map((spot) => (
            <Swipeable
              key={spot.id}
              renderRightActions={() => renderRightActions(spot)}
              overshootRight={false}
              rightThreshold={40}
            >
              <ParkingSpotCard
                spot={convertToParkingSpot(spot)}
                navigation={navigation}
                isInitiallySaved={true}
                onSavedChange={(isSaved) =>
                  handleCardSavedChange(spot.id, isSaved)
                }
              />
            </Swipeable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: 60,
    paddingBottom: spacing.lg,
  },

  title: {
    fontSize: 28,
    fontWeight: fontWeight.bold,
  },

  subtitle: {
    marginTop: spacing.xs,
    fontSize: 14,
  },

  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },

  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
  },

  stateText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
  },

  signInButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 12,
    marginTop: spacing.sm,
  },

  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: fontWeight.semibold,
  },

  removeAction: {
    width: 100,
    height: 285,
    marginBottom: spacing.lg,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  removeActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: fontWeight.bold,
  },
});
