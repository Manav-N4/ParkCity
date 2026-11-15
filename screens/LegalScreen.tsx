
import { View, Text, TouchableOpacity, StyleSheet, Linking, Alert } from 'react-native'
import { useTheme } from '../contexts/ThemeContext'
import { API_BASE_URL } from '../lib/api'
import { supabase } from '../lib/supabase'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../App'

type Nav = NativeStackNavigationProp<RootStackParamList>

export default function LegalScreen() {
  const { colors } = useTheme()
  const navigation = useNavigation<Nav>()

  const openURL = (url: string) => void Linking.openURL(url)

  const downloadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch(`${API_BASE_URL}/account/export`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      const path = FileSystem.documentDirectory + 'parkcity-data.json'
      await FileSystem.writeAsStringAsync(path, JSON.stringify(data, null, 2))
      await Sharing.shareAsync(path)
    } catch (e) {
      Alert.alert('Error', 'Could not export your data. Try again.')
    }
  }

  const deleteAccount = () => {
    Alert.alert(
      'Delete Account',
      "This will permanently delete your account and all personal data. Contributions you've made will be anonymised. This cannot be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data: { session } } = await supabase.auth.getSession()
              if (!session) return

              const res = await fetch(`${API_BASE_URL}/account/delete`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${session.access_token}` },
              })
              if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error)
              }
              await supabase.auth.signOut()
              navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] })
            } catch (e) {
              Alert.alert(
                'Error',
                e instanceof Error ? e.message : 'Could not delete account. Try again.',
              )
            }
          },
        },
      ],
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>

      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Legal</Text>

      <TouchableOpacity
        style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => openURL('https://park-city.in/privacy')}
        activeOpacity={0.7}
      >
        <Text style={[styles.rowLabel, { color: colors.text }]}>Privacy Policy</Text>
        <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => openURL('https://park-city.in/terms')}
        activeOpacity={0.7}
      >
        <Text style={[styles.rowLabel, { color: colors.text }]}>Terms of Use</Text>
        <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
      </TouchableOpacity>

      <View style={[styles.disclaimerBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.disclaimerText, { color: colors.textSecondary }]}>
          Information provided as-is. Verify signage on-site before parking.
        </Text>
      </View>

      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Your Data</Text>

      <TouchableOpacity
        style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => void downloadData()}
        activeOpacity={0.7}
      >
        <Text style={[styles.rowLabel, { color: colors.text }]}>Download My Data</Text>
        <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={deleteAccount}
        activeOpacity={0.7}
      >
        <Text style={[styles.rowLabel, { color: '#E23744' }]}>Delete My Account</Text>
        <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
      </TouchableOpacity>

    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  rowLabel: { fontSize: 15 },
  chevron: { fontSize: 18 },
  disclaimerBox: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  disclaimerText: { fontSize: 13, lineHeight: 20 },
  error: { color: '#E23744' },
})
