
import {
  Linking,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../App';
import {
  colors,
  fontWeight,
  radius,
  spacing,
  typography,
} from '../constants/tokens';

type Props = NativeStackScreenProps<
  RootStackParamList,
  'ParkingDetails'
>;

export default function ParkingDetailsScreen({
  route,
  navigation,
}: Props) {
  const { spot } = route.params;

  const handleNavigate = async () => {
    const url =
      `https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}`;

    try {
      await Linking.openURL(url);
    } catch (error) {
      console.error('Could not open Google Maps:', error);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => navigation.goBack()}
        style={styles.backButton}
      >
        <Text style={styles.backText}>← Back to parking</Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.eyebrow}>PARKING DETAILS</Text>

        <Text style={styles.name}>{spot.name}</Text>

        <View style={styles.divider} />

        <Text style={styles.label}>Hourly price</Text>
        <Text style={styles.price}>
          {spot.price_per_hour == null
            ? 'Price unavailable'
            : `₹${spot.price_per_hour}/hr`}
        </Text>

        <Text style={styles.label}>Parking location</Text>
        <Text style={styles.coordinates}>
          {spot.lat.toFixed(6)}, {spot.lng.toFixed(6)}
        </Text>

        <Pressable
          style={styles.navigateButton}
          onPress={handleNavigate}
        >
          <Text style={styles.navigateButtonText}>
            Navigate with Google Maps
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    paddingTop: spacing.xl * 2,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  backText: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: fontWeight.medium,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  eyebrow: {
    color: colors.textSecondary,
    fontSize: typography.small,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  name: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: fontWeight.bold,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },
  label: {
    color: colors.textSecondary,
    fontSize: typography.small,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  price: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: fontWeight.semibold,
  },
  coordinates: {
    color: colors.text,
    fontSize: typography.body,
  },
  navigateButton: {
    backgroundColor: colors.text,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  navigateButtonText: {
    color: colors.background,
    fontSize: typography.body,
    fontWeight: fontWeight.semibold,
  },
});
