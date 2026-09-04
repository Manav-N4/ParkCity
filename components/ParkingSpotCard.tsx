import { StyleSheet, Text, View } from 'react-native';

import {
  colors,
  fontWeight,
  radius,
  spacing,
  typography,
} from '../constants/tokens';
import { ParkingSpot } from '../types/parking';

type ParkingSpotCardProps = {
  spot: ParkingSpot;
};

export default function ParkingSpotCard({ spot }: ParkingSpotCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.content}>
        <Text style={styles.name}>{spot.name}</Text>

        <Text style={styles.address}>{spot.address}</Text>

        <View style={styles.meta}>
          <Text style={styles.distance}>
            {Math.round(spot.distance_meters)} m
          </Text>

          <Text style={styles.price}>
            ₹{spot.price_per_hour}/hr
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },

  content: {
    padding: spacing.md,
  },

  name: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.sm,
  },

  address: {
    color: colors.textSecondary,
    fontSize: typography.small,
    lineHeight: typography.smallLineHeight,
    marginBottom: spacing.md,
  },

  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  distance: {
    color: colors.textSecondary,
    fontSize: typography.small,
    lineHeight: typography.smallLineHeight,
  },

  price: {
    color: colors.text,
    fontSize: typography.small,
    lineHeight: typography.smallLineHeight,
    fontWeight: fontWeight.semibold,
  },
});