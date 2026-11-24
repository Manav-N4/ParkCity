
import { useState, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  Switch,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native'
import Constants from 'expo-constants'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../contexts/ThemeContext'
import { API_BASE_URL } from '../lib/api'
import { supabase } from '../lib/supabase'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../App'
import {
  colors as lightColors,
  fontWeight,
  letterSpacing,
  radius,
  shadow,
  spacing,
  typography,
} from '../constants/tokens'

type Nav = NativeStackNavigationProp<RootStackParamList>

interface ProfilePreferences {
  reminders_enabled?: boolean | null
  satisfaction_prompts_enabled?: boolean | null
}

type NotificationPreference = 'reminders' | 'satisfaction'

type IoniconName = keyof typeof Ionicons.glyphMap

export default function SettingsScreen() {
  const { colors, isDark, setTheme } = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const insets = useSafeAreaInsets()
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

  // Light: grey track on white; dark: deep track so the white thumb stands out.
  const switchTrack = {
    false: isDark ? colors.borderStrong : colors.textSecondary,
    true: colors.primary,
  }

  const settingRow = (
    icon: IoniconName,
    label: string,
    control: React.ReactNode,
    showDivider: boolean,
  ) => (
    <View style={[styles.settingRow, showDivider && styles.rowDivider]}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={18} color={colors.primaryDeep} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      {control}
    </View>
  )

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + spacing.sm },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Pressable
        onPress={() => navigation.goBack()}
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={6}
      >
        <Ionicons name="arrow-back" size={20} color={colors.text} />
      </Pressable>

      <Text style={styles.title}>Settings</Text>

      <Text style={styles.sectionLabel}>APPEARANCE</Text>
      <View style={styles.card}>
        {settingRow(
          'moon-outline',
          'Dark Mode',
          <Switch
            value={isDark}
            onValueChange={(val) => void setTheme(val ? 'dark' : 'light')}
            trackColor={switchTrack}
            thumbColor={colors.white}
            accessibilityLabel="Dark Mode"
          />,
          false,
        )}
      </View>

      <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
      <View style={styles.card}>
        {settingRow(
          'notifications-outline',
          'Parking Reminders',
          <Switch
            value={reminders}
            onValueChange={(val) => void updateNotificationPref('reminders', val)}
            trackColor={switchTrack}
            thumbColor={colors.white}
            accessibilityLabel="Parking Reminders"
          />,
          true,
        )}
        {settingRow(
          'star-outline',
          'Rate Your Experience',
          <Switch
            value={satisfactionPrompts}
            onValueChange={(val) =>
              void updateNotificationPref('satisfaction', val)
            }
            trackColor={switchTrack}
            thumbColor={colors.white}
            accessibilityLabel="Rate Your Experience"
          />,
          false,
        )}
      </View>

      <Text style={styles.sectionLabel}>ABOUT</Text>
      <View style={styles.card}>
        {settingRow(
          'information-circle-outline',
          'Version',
          <Text style={styles.rowValue}>
            {Constants.expoConfig?.version ?? '1.0.0'}
          </Text>,
          false,
        )}
      </View>
    </ScrollView>
  )
}

const createStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xl,
    },
    pressed: {
      opacity: 0.75,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
      ...shadow.sm,
    },
    title: {
      color: colors.text,
      fontSize: typography.title,
      lineHeight: typography.titleLineHeight,
      fontWeight: fontWeight.bold,
      letterSpacing: letterSpacing.tight,
    },
    sectionLabel: {
      color: colors.goldDeep,
      fontSize: typography.overline,
      lineHeight: typography.overlineLineHeight,
      fontWeight: fontWeight.bold,
      letterSpacing: letterSpacing.overline,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
      marginLeft: spacing.xs,
    },
    card: {
      borderRadius: radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    settingRow: {
      minHeight: 60,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
    },
    rowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    iconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowLabel: {
      flex: 1,
      color: colors.text,
      fontSize: 15,
      fontWeight: fontWeight.semibold,
    },
    rowValue: {
      color: colors.textSecondary,
      fontSize: typography.small,
    },
  })
