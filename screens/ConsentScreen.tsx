
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../App'
import { useTheme } from '../contexts/ThemeContext'
import { spacing, fontWeight, radius } from '../constants/tokens'

type Nav = NativeStackNavigationProp<RootStackParamList>

export default function ConsentScreen() {
  const { colors } = useTheme()
  const navigation = useNavigation<Nav>()

  const accept = async () => {
    await AsyncStorage.setItem('consent_given', 'true')
    navigation.replace('MainTabs')
  }

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
        style={[styles.btn, { backgroundColor: colors.primary }]}
        onPress={() => void accept()}
        activeOpacity={0.85}
      >
        <Text style={styles.btnText}>I understand — Continue</Text>
      </TouchableOpacity>

      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        By continuing you agree to our Privacy Policy and Terms of Use.
      </Text>
    </View>
  )
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
})

