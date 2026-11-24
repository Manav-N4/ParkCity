
import { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  View,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { radius, spacing } from '../../constants/tokens';

type Props = {
  // 'row' is the compact list skeleton; 'photo' mirrors ParkingSpotCard.
  variant?: 'row' | 'photo';
};

export default function SkeletonCard({ variant = 'row' }: Props) {
  const { colors } = useTheme();
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => animation.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 0.9],
  });

  const placeholderStyle = {
    backgroundColor: colors.skeleton,
    opacity,
  };

  if (variant === 'photo') {
    return (
      <View
        accessibilityLabel="Loading parking spot"
        style={[
          styles.photoCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <Animated.View style={[styles.photoImage, placeholderStyle]} />

        <View style={styles.photoInfo}>
          <Animated.View
            style={[styles.photoTitle, placeholderStyle]}
          />
          <Animated.View
            style={[styles.photoSubtitle, placeholderStyle]}
          />

          <View
            style={[
              styles.photoFooter,
              { borderTopColor: colors.border },
            ]}
          >
            <Animated.View
              style={[styles.photoPrice, placeholderStyle]}
            />
            <Animated.View
              style={[styles.photoAction, placeholderStyle]}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View
      accessibilityLabel="Loading parking spot"
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <Animated.View
        style={[styles.image, placeholderStyle]}
      />

      <View style={styles.content}>
        <Animated.View
          style={[styles.title, placeholderStyle]}
        />
        <Animated.View
          style={[styles.subtitle, placeholderStyle]}
        />

        <View style={styles.footer}>
          <Animated.View
            style={[styles.price, placeholderStyle]}
          />
          <Animated.View
            style={[styles.action, placeholderStyle]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Row variant
  card: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  image: {
    width: 100,
    minHeight: 120,
    borderRadius: radius.sm,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  title: {
    height: 18,
    width: '75%',
    borderRadius: radius.sm,
  },
  subtitle: {
    height: 14,
    width: '55%',
    borderRadius: radius.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  price: {
    height: 16,
    width: 65,
    borderRadius: radius.sm,
  },
  action: {
    height: 30,
    width: 85,
    borderRadius: radius.sm,
  },

  // Photo variant: matches ParkingSpotCard (285 tall, 136 photo)
  photoCard: {
    height: 285,
    marginBottom: spacing.lg,
    borderRadius: radius.xxl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  photoImage: {
    height: 136,
  },
  photoInfo: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: 14,
    paddingBottom: 14,
    gap: spacing.sm,
  },
  photoTitle: {
    height: 18,
    width: '70%',
    borderRadius: radius.sm,
  },
  photoSubtitle: {
    height: 12,
    width: '50%',
    borderRadius: radius.sm,
  },
  photoFooter: {
    marginTop: 'auto',
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  photoPrice: {
    height: 18,
    width: 72,
    borderRadius: radius.sm,
  },
  photoAction: {
    height: 32,
    width: 72,
    borderRadius: radius.pill,
  },
});
