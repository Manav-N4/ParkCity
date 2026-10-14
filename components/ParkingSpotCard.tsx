
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { RootStackParamList } from '../App';
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
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
};

export default function ParkingSpotCard({
  spot,
  navigation,
}: ParkingSpotCardProps) {
  const handlePress = () => {
    navigation.navigate('ParkingDetails', { spot });
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.name}>{spot.name}</Text>

        <View style={styles.meta}>
          <Text style={styles.price}>
            {spot.price_per_hour == null
              ? 'Price unavailable'
              : `₹${spot.price_per_hour}/hr`}
          </Text>
        </View>
      </View>
    </Pressable>
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
  cardPressed: {
    opacity: 0.75,
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
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  price: {
    color: colors.text,
    fontSize: typography.small,
    lineHeight: typography.smallLineHeight,
    fontWeight: fontWeight.semibold,
  },
});
