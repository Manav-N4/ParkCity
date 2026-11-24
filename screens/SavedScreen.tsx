
import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { useDialog } from '../contexts/DialogContext';
import {
  colors as lightColors,
  fontWeight,
  letterSpacing,
  radius,
  spacing,
  typography,
} from '../constants/tokens';

import ParkingSpotCard from '../components/ParkingSpotCard';
import SkeletonCard from '../components/ui/SkeletonCard';
import EmptyState from '../components/ui/EmptyState';
import PrimaryButton from '../components/ui/PrimaryButton';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Saved'>,
  NativeStackScreenProps<RootStackParamList>
>;

// Must match ParkingSpotCard's fixed height (285) and bottom margin,
// so the swipe action lines up with the card.
const REMOVE_ACTION_HEIGHT = 285;
const REMOVE_SLOT_WIDTH = 100;

export default function SavedScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { showDialog } = useDialog();

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
      showDialog({
        type: 'error',
        title: 'Unable to remove spot',
        message:
          err instanceof Error
            ? err.message
            : 'Please try again.',
      });
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
    address: spot.address,
    lat: spot.lat,
    lng: spot.lng,
    price_per_hour: spot.price_per_hour,
    source: spot.source,
  });

  const renderRightActions = (spot: SavedSpot) => (
    <View style={styles.removeSlot}>
      <Pressable
        onPress={() => handleRemove(spot)}
        disabled={removingId !== null}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${spot.name} from saved spots`}
        style={({ pressed }) => [
          styles.removeAction,
          { backgroundColor: colors.errorStrong },
          pressed && styles.removeActionPressed,
        ]}
      >
        <Ionicons
          name="trash-outline"
          size={20}
          color={colors.white}
        />
        <Text style={styles.removeActionText}>
          {removingId === spot.id ? 'Removing...' : 'Remove'}
        </Text>
      </Pressable>
    </View>
  );

  const showCount =
    !loading && isSignedIn && !error && savedSpots.length > 0;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + spacing.md },
        ]}
      >
        <View style={styles.headerText}>
          <Text style={styles.title}>Saved Spots</Text>

          <Text style={styles.subtitle}>
            Your favourite parking locations.
          </Text>
        </View>

        {showCount && (
          <View style={styles.countChip}>
            <Text style={styles.countChipText}>
              {savedSpots.length} saved
            </Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={[styles.list, { paddingTop: 8 }]}>
          <SkeletonCard variant="photo" />
          <SkeletonCard variant="photo" />
          <SkeletonCard variant="photo" />
        </View>
      ) : !isSignedIn ? (
        <View style={styles.centerState}>
          <EmptyState
            icon="heart-outline"
            heading="Sign in to save spots"
            subtext="Sign in to view and manage your saved parking locations."
          />

          <PrimaryButton
            title="Sign in"
            onPress={() =>
              navigation
                .getParent<NativeStackNavigationProp<RootStackParamList>>()
                ?.navigate('EmailLogin', {})
            }
            style={styles.stateButton}
          />
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <EmptyState
            icon="alert-circle-outline"
            heading="Couldn't load saved spots"
            subtext={error}
          />

          <PrimaryButton
            title="Try again"
            onPress={() => void loadSavedSpots()}
            style={styles.stateButton}
          />
        </View>
      ) : savedSpots.length === 0 ? (
        <View style={styles.centerState}>
          <EmptyState
            icon="bookmark-outline"
            heading="No saved spots yet"
            subtext="Start exploring and save your favourite parking spots here."
          />

          <PrimaryButton
            title="Explore parking"
            variant="outline"
            onPress={() => navigation.navigate('Home')}
            style={styles.stateButton}
          />
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

const createStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    header: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
    },

    headerText: {
      flex: 1,
      minWidth: 0,
    },

    title: {
      color: colors.text,
      fontSize: typography.title,
      lineHeight: typography.titleLineHeight,
      fontWeight: fontWeight.bold,
      letterSpacing: letterSpacing.tight,
    },

    subtitle: {
      marginTop: spacing.xs,
      color: colors.textSecondary,
      fontSize: typography.small,
      lineHeight: typography.smallLineHeight,
    },

    countChip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.pill,
      backgroundColor: colors.champagneSoft,
      marginBottom: 2,
    },

    countChipText: {
      color: colors.goldDeep,
      fontSize: typography.caption,
      fontWeight: fontWeight.semibold,
    },

    list: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xl,
    },

    centerState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xl,
    },

    stateButton: {
      alignSelf: 'center',
      minWidth: 180,
      paddingHorizontal: spacing.xl,
    },

    // Swipe-to-remove action
    removeSlot: {
      width: REMOVE_SLOT_WIDTH,
      height: REMOVE_ACTION_HEIGHT,
      marginBottom: spacing.lg,
      paddingLeft: 12,
    },

    removeAction: {
      flex: 1,
      borderRadius: radius.xxl,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },

    removeActionPressed: {
      opacity: 0.85,
    },

    removeActionText: {
      color: colors.white,
      fontSize: 13,
      fontWeight: fontWeight.semibold,
    },
  });
