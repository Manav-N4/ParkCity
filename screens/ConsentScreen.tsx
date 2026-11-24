
import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../App';
import type { ParkingSpot } from '../types/parking';

import { useTheme } from '../contexts/ThemeContext';
import { useDialog } from '../contexts/DialogContext';
import { spacing, fontWeight, radius } from '../constants/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type PostLoginDestination =
  | {
      screen: 'ClaimSpot';
      spot: ParkingSpot;
    }
  | {
      screen: 'ParkingDetails';
      spot: ParkingSpot;
    };

const PENDING_DESTINATION_KEY = 'pending_post_login_destination';

function isPostLoginDestination(
  value: unknown,
): value is PostLoginDestination {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const destination = value as {
    screen?: unknown;
    spot?: unknown;
  };

  return (
    (destination.screen === 'ClaimSpot' ||
      destination.screen === 'ParkingDetails') &&
    typeof destination.spot === 'object' &&
    destination.spot !== null
  );
}

export default function ConsentScreen() {
  const { colors } = useTheme();
  const { showDialog } = useDialog();
  const navigation = useNavigation<Nav>();

  const [loading, setLoading] = useState(false);

  const accept = async () => {
    if (loading) return;

    setLoading(true);

    try {
      await AsyncStorage.setItem('consent_given', 'true');

      const storedDestination = await AsyncStorage.getItem(
        PENDING_DESTINATION_KEY,
      );

      if (storedDestination) {
        let destination: unknown;

        try {
          destination = JSON.parse(storedDestination);
        } catch {
          console.warn('Invalid pending post-login destination.');
          destination = null;
        }

        if (isPostLoginDestination(destination)) {
          await AsyncStorage.removeItem(PENDING_DESTINATION_KEY);

          if (destination.screen === 'ClaimSpot') {
            navigation.replace('ClaimSpot', {
              spot: destination.spot,
            });
          } else {
            navigation.replace('ParkingDetails', {
              spot: destination.spot,
            });
          }

          return;
        }

        // Remove invalid or outdated destinations.
        await AsyncStorage.removeItem(PENDING_DESTINATION_KEY);
      }

      navigation.replace('MainTabs');
    } catch (error) {
      showDialog({
        type: 'error',
        title: 'Something went wrong',
        message:
          error instanceof Error
            ? error.message
            : 'Could not save your consent. Please try again.',
      });

      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.iconRow}>
        <Text style={styles.icon}>🅿️</Text>
      </View>

      <Text style={[styles.title, { color: colors.text }]}>
        Before you start
      </Text>

      <Text style={[styles.body, { color: colors.textSecondary }]}>
        Park City uses your location to show nearby parking and confirm when
        you arrive at a spot.{'\n\n'}
        Your location is never stored or shared with third parties.
      </Text>

      <TouchableOpacity
        style={[
          styles.btn,
          {
            backgroundColor: colors.primary,
            opacity: loading ? 0.7 : 1,
          },
        ]}
        onPress={() => void accept()}
        activeOpacity={0.85}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.btnText}>
            I understand — Continue
          </Text>
        )}
      </TouchableOpacity>

      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        By continuing you agree to our Privacy Policy and Terms of Use.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'center',
  },
  iconRow: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  icon: {
    fontSize: 56,
  },
  title: {
    fontSize: 26,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.md,
  },
  body: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 40,
  },
  btn: {
    borderRadius: radius.md,
    padding: 16,
    alignItems: 'center',
    marginBottom: spacing.md,
    minHeight: 54,
    justifyContent: 'center',
  },
  btnText: {
    color: '#fff',
    fontWeight: fontWeight.bold,
    fontSize: 16,
  },
  hint: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
