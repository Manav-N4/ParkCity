
import { useState, useEffect } from 'react'
import {
  View,
  Text,
  Switch,
  StyleSheet,
  TouchableOpacity,
} from 'react-native'
import Constants from 'expo-constants'
import { useTheme } from '../contexts/ThemeContext'
import { API_BASE_URL } from '../lib/api'
import { supabase } from '../lib/supabase'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../App'

type Nav = NativeStackNavigationProp<RootStackParamList>

interface ProfilePreferences {
  reminders_enabled?: boolean | null
  satisfaction_prompts_enabled?: boolean | null
}

type NotificationPreference = 'reminders' | 'satisfaction'

export default function SettingsScreen() {
  const { colors, isDark, setTheme } = useTheme()
  const navigation = useNavigation<Nav>()

  const [reminders, setReminders] = useState<boolean>(true)
  const [satisfactionPrompts, setSatisfactionPrompts] = useState<boolean>(true)

  useEffect(() => {
    void loadPrefs()
  }, [])

  const loadPrefs = async (): Promise<void> => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) return

      const res = await fetch(`${API_BASE_URL}/profile/${session.user.id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (!res.ok) return

      const data: ProfilePreferences = await res.json()

      if (data) {
        setReminders(data.reminders_enabled ?? true)
        setSatisfactionPrompts(data.satisfaction_prompts_enabled ?? true)
      }
    } catch (e) {
      console.error('load prefs error:', e)
    }
  }

  const updateNotificationPref = async (
    key: NotificationPreference,
    val: boolean,
  ): Promise<void> => {
    if (key === 'reminders') setReminders(val)
    if (key === 'satisfaction') setSatisfactionPrompts(val)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) return

      await fetch(`${API_BASE_URL}/settings/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          reminders_enabled: key === 'reminders' ? val : reminders,
          satisfaction_prompts_enabled:
            key === 'satisfaction' ? val : satisfactionPrompts,
        }),
      })
    } catch (e) {
      console.error('update pref error:', e)
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>

      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
        Appearance
      </Text>
      <View
        style={[
          styles.row,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.rowLabel, { color: colors.text }]}>Dark Mode</Text>
        <Switch
          value={isDark}
          onValueChange={(val) => void setTheme(val ? 'dark' : 'light')}
          trackColor={{ true: colors.primary }}
          thumbColor="#fff"
        />
      </View>

      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
        Notifications
      </Text>
      <View
        style={[
          styles.row,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.rowLabel, { color: colors.text }]}>
          Parking Reminders
        </Text>
        <Switch
          value={reminders}
          onValueChange={(val) => void updateNotificationPref('reminders', val)}
          trackColor={{ true: colors.primary }}
          thumbColor="#fff"
        />
      </View>
      <View
        style={[
          styles.row,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.rowLabel, { color: colors.text }]}>
          Rate Your Experience
        </Text>
        <Switch
          value={satisfactionPrompts}
          onValueChange={(val) =>
            void updateNotificationPref('satisfaction', val)
          }
          trackColor={{ true: colors.primary }}
          thumbColor="#fff"
        />
      </View>

      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
        About
      </Text>
      <View
        style={[
          styles.row,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.rowLabel, { color: colors.text }]}>Version</Text>
        <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
          {Constants.expoConfig?.version ?? '1.0.0'}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => navigation.navigate('Legal')}
        activeOpacity={0.7}
      >
        <Text style={[styles.rowLabel, { color: colors.text }]}>Privacy & Legal</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 18 }}>›</Text>
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
  rowValue: { fontSize: 14 },
})
