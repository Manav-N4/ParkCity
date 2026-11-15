import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useTheme } from '../contexts/ThemeContext'

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
    <TouchableOpacity
      style={[styles.card, { borderColor: colors.primary, backgroundColor: colors.surface }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.sponsoredBadge}>
        <Text style={[styles.sponsoredText, { color: colors.textSecondary }]}>Sponsored</Text>
      </View>
      <Text style={[styles.name, { color: colors.text }]}>{spot.name}</Text>
      {spot.address && (
        <Text style={[styles.address, { color: colors.textSecondary }]}>{spot.address}</Text>
      )}
      {spot.price_per_hour != null && (
        <Text style={[styles.price, { color: colors.primary }]}>₹{spot.price_per_hour}/hr</Text>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  sponsoredBadge: {
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  sponsoredText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  address: {
    fontSize: 13,
    marginBottom: 4,
  },
  price: {
    fontSize: 14,
    fontWeight: '600',
  },
})

