
import { useRef, useState } from 'react';
import {
  Animated,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { RootStackParamList } from '../App';
import VerificationBadge from './VerificationBadge';
import {
  colors,
  fontWeight,
  spacing,
} from '../constants/tokens';
import { ParkingSpot } from '../types/parking';

type ParkingSpotCardProps = {
  spot: ParkingSpot;
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
};

const PARKING_PLACEHOLDER =
  'https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=1200&q=85';

export default function ParkingSpotCard({
  spot,
  navigation,
}: ParkingSpotCardProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  const heartScale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    navigation.navigate('ParkingDetails', { spot });
  };

  const toggleFavorite = () => {
    setIsFavorite((previous) => !previous);

    heartScale.setValue(0.75);

    Animated.spring(heartScale, {
      toValue: 1,
      friction: 4,
      tension: 180,
      useNativeDriver: true,
    }).start();
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

        {/* Three-tier verification badge */}
        <View style={styles.badgePosition}>
          <VerificationBadge tier={verificationTier} />
        </View>

        {/* Animated favorite button */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            isFavorite ? 'Remove from favorites' : 'Add to favorites'
          }
          accessibilityState={{ selected: isFavorite }}
          hitSlop={8}
          onPress={(event) => {
            event.stopPropagation();
            toggleFavorite();
          }}
          style={({ pressed }) => [
            styles.favoriteButton,
            isFavorite && styles.favoriteButtonActive,
            pressed && styles.favoriteButtonPressed,
          ]}
        >
          <Animated.View
            style={{
              transform: [{ scale: heartScale }],
            }}
          >
            <Svg width={25} height={25} viewBox="0 0 24 24">
              <Path
                d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z"
                fill={isFavorite ? colors.error : 'none'}
                stroke={isFavorite ? colors.error : colors.text}
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Animated.View>
        </Pressable>

        {/* Parking information */}
        <View style={styles.content}>
          <Text numberOfLines={2} style={styles.name}>
            {spot.name}
          </Text>

          <Text style={styles.location}>
            Parking location
          </Text>

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
              onPress={(event) => {
                event.stopPropagation();
                handlePress();
              }}
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
    marginBottom: spacing.lg ?? 24,
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
