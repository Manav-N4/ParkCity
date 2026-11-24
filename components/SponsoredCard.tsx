import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../contexts/ThemeContext'
import {
  fontWeight,
  letterSpacing,
  radius,
  shadow,
  spacing,
} from '../constants/tokens'

type SponsoredSpot = {
  id: string
  name: string
  address?: string | null
  price_per_hour?: number | null
  source?: string
}

type Props = {
  spot: SponsoredSpot
  onPress?: () => void
}

export default function SponsoredCard({ spot, onPress }: Props) {
  const { colors } = useTheme()

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Sponsored parking: ${spot.name}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.champagne,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={styles.content}>
        <View
          style={[
            styles.sponsoredChip,
            { backgroundColor: colors.champagneSoft },
          ]}
        >
          <Ionicons
            name="megaphone-outline"
            size={11}
            color={colors.goldDeep}
          />
          <Text style={[styles.sponsoredText, { color: colors.goldDeep }]}>
            Sponsored
          </Text>
        </View>

        <Text
          style={[styles.name, { color: colors.text }]}
          numberOfLines={2}
        >
          {spot.name}
        </Text>

        {spot.address && (
          <Text
            style={[styles.address, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {spot.address}
          </Text>
        )}

        {spot.price_per_hour != null && (
          <Text style={[styles.price, { color: colors.primaryDeep }]}>
            ₹{spot.price_per_hour}
            <Text style={[styles.priceUnit, { color: colors.textSecondary }]}>
              {' '}/hr
            </Text>
          </Text>
        )}
      </View>

      <Ionicons
        name="chevron-forward"
        size={20}
        color={colors.textSecondary}
      />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadow.sm,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  sponsoredChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    marginBottom: spacing.sm,
  },
  sponsoredText: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.wide,
  },
  name: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.snug,
  },
  address: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  price: {
    fontSize: 16,
    fontWeight: fontWeight.bold,
    marginTop: spacing.sm,
  },
  priceUnit: {
    fontSize: 13,
    fontWeight: fontWeight.regular,
  },
})
