
import { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  View,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { radius, spacing } from '../../constants/tokens';

export default function SkeletonCard() {
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
    outputRange: [0.35, 0.8],
  });

  const placeholderStyle = {
    backgroundColor: colors.border,
    opacity,
  };

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
});
