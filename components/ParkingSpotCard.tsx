
import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';

import VerificationBadge from './VerificationBadge';
import {
  colors,
  fontWeight,
  spacing,
} from '../constants/tokens';
import type { ParkingSpot } from '../types/parking';
import { getSavedSpots, toggleSavedSpot } from '../lib/api';
import { supabase } from '../lib/supabase';

type ParkingSpotCardProps = {
  spot: ParkingSpot;
  navigation: {
    navigate: (
      screen: 'ParkingDetails',
      params: { spot: ParkingSpot }
    ) => void;
  };
  isInitiallySaved?: boolean;
  onSavedChange?: (isSaved: boolean) => void;
};

const PARKING_PLACEHOLDER =
  'https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=1200&q=85';

export default function ParkingSpotCard({
  spot,
  navigation,
  isInitiallySaved,
  onSavedChange,
}: ParkingSpotCardProps) {
  const [isSaved, setIsSaved] = useState(isInitiallySaved ?? false);
  const [isSaving, setIsSaving] = useState(false);
  const heartScale = useRef(new Animated.Value(1)).current;

  const hasValidSpotId =
    typeof spot.id === 'string' && spot.id.trim().length > 0;

  useFocusEffect(
    useCallback(() => {
      if (isInitiallySaved !== undefined) {
        setIsSaved(isInitiallySaved);
        return;
      }

      let isActive = true;

      const checkSavedStatus = async () => {
        if (!hasValidSpotId) {
          if (isActive) setIsSaved(false);
          return;
        }

        try {
          const {
            data: { session },
            error,
          } = await supabase.auth.getSession();

          if (error) throw error;

          if (!session?.access_token) {
            if (isActive) setIsSaved(false);
            return;
          }

          const savedSpots = await getSavedSpots(session.access_token);

          const saved = savedSpots.some(
            (savedSpot) => savedSpot.id === spot.id
          );

          if (isActive) setIsSaved(saved);
        } catch (error) {
          console.error('Could not check saved status:', error);
        }
      };

      void checkSavedStatus();

      return () => {
        isActive = false;
      };
    }, [spot.id, isInitiallySaved, hasValidSpotId])
  );

  const handlePress = () => {
    console.log('[ParkCity] Parking card pressed:', {
      id: spot.id,
      name: spot.name,
    });

    try {
      navigation.navigate('ParkingDetails', { spot });
      console.log('[ParkCity] ParkingDetails navigation dispatched');
    } catch (error) {
      console.error('[ParkCity] Navigation failed:', error);
      Alert.alert(
        'Navigation error',
        error instanceof Error ? error.message : 'Unable to open parking details.'
      );
    }
  };

  const animateHeart = () => {
    heartScale.setValue(0.75);

    Animated.spring(heartScale, {
      toValue: 1,
      friction: 4,
      tension: 180,
      useNativeDriver: true,
    }).start();
  };

  const toggleFavorite = async () => {
    if (isSaving) return;

    if (!hasValidSpotId || !spot.id) {
      Alert.alert(
        'Cannot save this spot',
        'This parking spot is temporarily unavailable for saving. Please try again later.'
      );
      return;
    }

    setIsSaving(true);

    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) throw error;

      if (!session?.access_token) {
        Alert.alert(
          'Sign in required',
          'Please sign in to save your favourite parking spots.'
        );
        return;
      }

      const action = isSaved ? 'unsave' : 'save';

      await toggleSavedSpot(
        session.access_token,
        spot.id,
        action
      );

      const nextSavedState = !isSaved;

      setIsSaved(nextSavedState);
      onSavedChange?.(nextSavedState);
      animateHeart();
    } catch (error) {
      console.error('Could not update saved spot:', error);

      Alert.alert(
        'Unable to update saved spots',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const verificationTier =
    spot.verification_tier ??
    (spot.source === 'google_raw' ? 'google_raw' : 'unverified');

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`View parking details for ${spot.name}`}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
      ]}
    >
      <ImageBackground
        source={{ uri: PARKING_PLACEHOLDER }}
        style={styles.image}
        imageStyle={styles.imageStyle}
        resizeMode="cover"
      >
        <LinearGradient
          colors={[
            'rgba(10, 18, 14, 0.02)',
            'rgba(10, 18, 14, 0.18)',
            'rgba(10, 18, 14, 0.94)',
          ]}
          locations={[0.15, 0.5, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <View style={styles.badgePosition}>
          <VerificationBadge tier={verificationTier} />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            !hasValidSpotId
              ? 'This parking spot cannot currently be saved'
              : isSaved
                ? 'Remove from saved spots'
                : 'Save this spot'
          }
          accessibilityState={{
            selected: isSaved,
            disabled: isSaving || !hasValidSpotId,
          }}
          hitSlop={8}
          disabled={isSaving || !hasValidSpotId}
          onPress={toggleFavorite}
          style={({ pressed }) => [
            styles.favoriteButton,
            isSaved && styles.favoriteButtonActive,
            pressed && styles.favoriteButtonPressed,
            (isSaving || !hasValidSpotId) &&
              styles.favoriteButtonDisabled,
          ]}
        >
          <Animated.View
            style={{
              transform: [{ scale: heartScale }],
            }}
          >
            <Text
              style={[
                styles.favoriteIcon,
                isSaved && styles.favoriteIconActive,
              ]}
            >
              {isSaved ? '♥' : '♡'}
            </Text>
          </Animated.View>
        </Pressable>

        <View style={styles.content}>
          <Text numberOfLines={2} style={styles.name}>
            {spot.name}
          </Text>

          <Text style={styles.location}>Parking location</Text>

          <View style={styles.separator} />

          <View style={styles.bottomRow}>
            <View style={styles.priceContainer}>
              <Text style={styles.priceLabel}>PARKING RATE</Text>
              <Text style={styles.price} numberOfLines={1}>
                {spot.price_per_hour == null
                  ? 'Price unavailable'
                  : `₹${spot.price_per_hour}/hr`}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View parking details for ${spot.name}`}
              onPress={handlePress}
              style={({ pressed }) => [
                styles.directionsButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.directionsText}>
                View parking ↗
              </Text>
            </Pressable>
          </View>
        </View>
      </ImageBackground>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    height: 285,
    marginBottom: spacing.lg,
    borderRadius: 28,
    borderWidth: 4,
    borderColor: colors.white,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
  },
  cardPressed: {
    transform: [{ scale: 0.985 }],
  },
  image: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.textSecondary,
  },
  imageStyle: {
    borderRadius: 23,
  },
  badgePosition: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 3,
    elevation: 3,
    maxWidth: '72%',
  },
  favoriteButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 3,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  favoriteButtonActive: {
    backgroundColor: colors.favoriteBackground,
    borderColor: colors.favoriteBorder,
  },
  favoriteButtonPressed: {
    opacity: 0.82,
  },
  favoriteButtonDisabled: {
    opacity: 0.6,
  },
  favoriteIcon: {
    fontSize: 27,
    lineHeight: 32,
    color: colors.textSecondary,
  },
  favoriteIconActive: {
    color: colors.error,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 15,
  },
  name: {
    color: colors.white,
    fontSize: 23,
    lineHeight: 28,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.4,
  },
  location: {
    marginTop: 3,
    color: colors.overlayText,
    fontSize: 13,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.overlaySurfaceBorder,
    marginVertical: 11,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  priceContainer: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  priceLabel: {
    color: colors.overlayText,
    fontSize: 9,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.1,
  },
  price: {
    color: colors.white,
    fontSize: 14,
    fontWeight: fontWeight.semibold,
  },
  directionsButton: {
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexShrink: 0,
  },
  directionsText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: fontWeight.bold,
  },
  buttonPressed: {
    opacity: 0.78,
  },
});
