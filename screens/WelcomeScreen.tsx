
import { useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../App';
import {
  colors,
  fontWeight,
  spacing,
} from '../constants/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

const KNOB_SIZE = 56;
const SLIDER_PADDING = 6;

export default function WelcomeScreen({ navigation }: Props) {
  const [sliderWidth, setSliderWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;

  const maxTravel = Math.max(
    0,
    sliderWidth - KNOB_SIZE - SLIDER_PADDING * 2,
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 5,

        onPanResponderMove: (_, gesture) => {
          const position = Math.max(
            0,
            Math.min(maxTravel, gesture.dx),
          );

          translateX.setValue(position);
        },

        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx >= maxTravel * 0.75 && maxTravel > 0) {
            Animated.spring(translateX, {
              toValue: maxTravel,
              useNativeDriver: true,
            }).start(() => {
              navigation.navigate('EmailLogin', {});
            });
          } else {
            Animated.spring(translateX, {
              toValue: 0,
              friction: 6,
              tension: 60,
              useNativeDriver: true,
            }).start();
          }
        },

        onPanResponderTerminate: () => {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        },
      }),
    [maxTravel, navigation, translateX],
  );

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Image
          source={require('../assets/icon.png')}
          style={styles.logo}
          contentFit="contain"
          accessibilityLabel="ParkCity logo"
        />
      </View>

      <View style={styles.illustrationContainer}>
        <Image
          source={require('../assets/parkcity-footer.png')}
          style={styles.illustration}
          contentFit="contain"
          transition={300}
          accessibilityLabel="ParkCity parking and city illustration"
        />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>
          Find, Claim, and Manage Parking
        </Text>

        <Text style={styles.description}>
          Discover nearby parking, secure your spot, and keep track
          of your parking history, all in one place.
        </Text>
      </View>

      <View
        style={styles.slider}
        onLayout={(event) =>
          setSliderWidth(event.nativeEvent.layout.width)
        }
      >
        <Text style={styles.sliderText}>
          Slide to Get Started
        </Text>

        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.sliderKnob,
            {
              transform: [{ translateX }],
            },
          ]}
          accessibilityRole="adjustable"
          accessibilityLabel="Slide to get started"
          accessibilityHint="Drag the arrow to the right to continue to login"
        >
          <Text style={styles.sliderArrow}>→</Text>
        </Animated.View>
      </View>

      <Text style={styles.footerText}>
        INTELLIGENCE IN EVERY SPACE
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: 24,
    paddingBottom: 24,
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  logoContainer: {
    width: '100%',
    height: 135,
    alignItems: 'center',
    justifyContent: 'center',
  },

  logo: {
    width: 210,
    height: 135,
  },

  illustrationContainer: {
    width: '100%',
    flex: 1,
    maxHeight: 390,
    minHeight: 190,
    justifyContent: 'center',
    alignItems: 'center',
  },

  illustration: {
    width: '100%',
    height: '100%',
  },

  content: {
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    marginTop: spacing.md,
  },

  title: {
    color: colors.text,
    fontSize: 29,
    lineHeight: 36,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.8,
    textAlign: 'center',
  },

  description: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
    marginTop: spacing.md,
    maxWidth: 330,
  },

  slider: {
    width: '100%',
    height: 68,
    marginTop: 32,
    borderRadius: 40,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SLIDER_PADDING,
  },

  sliderText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: fontWeight.semibold,
  },

  sliderKnob: {
    position: 'absolute',
    left: SLIDER_PADDING,
    top: SLIDER_PADDING,
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },

  sliderArrow: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: fontWeight.bold,
  },

  footerText: {
    color: colors.textSecondary,
    fontSize: 9,
    letterSpacing: 2,
    fontWeight: fontWeight.semibold,
    marginTop: spacing.lg,
  },
});
