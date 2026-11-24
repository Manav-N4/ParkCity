
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import VerificationBadge from './VerificationBadge';
import {
  colors as lightColors,
  fontWeight,
  letterSpacing,
  radius,
  shadow,
  spacing,
} from '../constants/tokens';
import { PARKING_PLACEHOLDER_URI } from '../constants/images';
import type { ParkingSpot } from '../types/parking';
import { getSavedSpots, toggleSavedSpot } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useDialog } from '../contexts/DialogContext';
import { useTheme } from '../contexts/ThemeContext';

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

// SavedScreen's swipe-to-remove action is sized to this card height.
const CARD_HEIGHT = 285;
const PHOTO_HEIGHT = 136;

export default function ParkingSpotCard({
  spot,
  navigation,
  isInitiallySaved,
  onSavedChange,
}: ParkingSpotCardProps) {
  const { showDialog } = useDialog();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
      showDialog({
        type: 'error',
        title: 'Navigation error',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to open parking details.',
      });
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

      if (error) throw error;

      if (!session?.access_token) {
        showDialog({
          type: 'warning',
          title: 'Sign in required',
          message: 'Please sign in to save your favourite parking spots.',
        });
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

      showDialog({
        type: 'error',
        title: 'Unable to update saved spots',
        message:
          error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const verificationTier =
    spot.verification_tier ??
    (spot.source === 'google_raw' ? 'google_raw' : 'unverified');

  const addressText =
    typeof spot.address === 'string' && spot.address.trim().length > 0
      ? spot.address
      : 'Parking location';

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
      <View style={styles.photo}>
        <Image
          source={{ uri: PARKING_PLACEHOLDER_URI }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
          accessible={false}
        />

        {/* Soft warm wash so the photo supports, rather than leads, the card */}
        <View style={styles.photoTint} pointerEvents="none" />

        <LinearGradient
          colors={['rgba(31,27,20,0.22)', 'rgba(31,27,20,0)']}
          locations={[0, 0.55]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <View style={styles.badgePosition}>
          <VerificationBadge tier={verificationTier} variant="onImage" />
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
            <Ionicons
              name={isSaved ? 'heart' : 'heart-outline'}
              size={20}
              color={isSaved ? colors.error : colors.textSecondary}
            />
          </Animated.View>
        </Pressable>
      </View>

      <View style={styles.info}>
        <Text numberOfLines={2} style={styles.name}>
          {spot.name}
        </Text>

        <Text numberOfLines={1} style={styles.address}>
          {addressText}
        </Text>

        <View style={styles.footer}>
          <View style={styles.priceContainer}>
            {spot.price_per_hour == null ? (
              <Text style={styles.priceUnavailable} numberOfLines={1}>
                Price unavailable
              </Text>
            ) : (
              <Text style={styles.price} numberOfLines={1}>
                ₹{spot.price_per_hour}
                <Text style={styles.priceUnit}> /hr</Text>
              </Text>
            )}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View parking details for ${spot.name}`}
            onPress={handlePress}
            hitSlop={6}
            style={({ pressed }) => [
              styles.viewButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.viewButtonText}>View</Text>
            <Ionicons
              name="arrow-forward"
              size={14}
              color={colors.primaryDeep}
            />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const createStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    card: {
      width: '100%',
      height: CARD_HEIGHT,
      marginBottom: spacing.lg,
      borderRadius: radius.xxl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      ...shadow.md,
    },
    cardPressed: {
      transform: [{ scale: 0.985 }],
    },
    photo: {
      height: PHOTO_HEIGHT,
      borderTopLeftRadius: radius.xxl,
      borderTopRightRadius: radius.xxl,
      overflow: 'hidden',
      backgroundColor: colors.skeleton,
    },
    photoTint: {
      ...StyleSheet.absoluteFill,
      backgroundColor: 'rgba(232,200,121,0.10)',
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
      top: 10,
      right: 10,
      zIndex: 3,
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      ...shadow.sm,
    },
    favoriteButtonActive: {
      backgroundColor: colors.favoriteBackground,
      borderWidth: 1,
      borderColor: colors.favoriteBorder,
    },
    favoriteButtonPressed: {
      opacity: 0.82,
    },
    favoriteButtonDisabled: {
      opacity: 0.6,
    },
    info: {
      flex: 1,
      paddingHorizontal: spacing.md,
      paddingTop: 14,
      paddingBottom: 14,
    },
    name: {
      color: colors.text,
      fontSize: 18,
      lineHeight: 23,
      fontWeight: fontWeight.bold,
      letterSpacing: letterSpacing.snug,
    },
    address: {
      marginTop: 3,
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    footer: {
      marginTop: 'auto',
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    priceContainer: {
      flex: 1,
      minWidth: 0,
    },
    price: {
      color: colors.primaryDeep,
      fontSize: 16,
      lineHeight: 22,
      fontWeight: fontWeight.bold,
    },
    priceUnit: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: fontWeight.regular,
    },
    priceUnavailable: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    viewButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primarySoft,
      borderRadius: radius.pill,
      paddingHorizontal: 14,
      paddingVertical: 7,
      flexShrink: 0,
    },
    viewButtonText: {
      color: colors.primaryDeep,
      fontSize: 13,
      fontWeight: fontWeight.semibold,
    },
    buttonPressed: {
      opacity: 0.78,
    },
  });
