
import { useMemo } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Linking,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../contexts/ThemeContext'
import { useDialog } from '../contexts/DialogContext'
import { API_BASE_URL } from '../lib/api'
import { supabase } from '../lib/supabase'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../App'
import ListRow from '../components/ui/ListRow'
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

export default function LegalScreen() {
  const { colors } = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const insets = useSafeAreaInsets()
  const { showDialog } = useDialog()
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
      showDialog({
        type: 'error',
        title: 'Export Failed',
        message: 'Could not export your data. Try again.',
      })
    }
  }

  const deleteAccount = () => {
    showDialog({
      type: 'confirmation',
      title: 'Delete Account',
      message:
        "This will permanently delete your account and all personal data. Contributions you've made will be anonymised. This cannot be undone.",
      actions: [
        {
          label: 'Cancel',
          variant: 'secondary',
        },
        {
          label: 'Delete',
          variant: 'destructive',
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
              showDialog({
                type: 'error',
                title: 'Error',
                message:
                  e instanceof Error
                    ? e.message
                    : 'Could not delete account. Try again.',
              })
            }
          },
        },
      ],
    })
  }

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

      <Text style={styles.title}>Privacy & Legal</Text>

      <Text style={styles.sectionLabel}>LEGAL</Text>
      <View style={styles.card}>
        <ListRow
          icon="document-text-outline"
          label="Privacy Policy"
          subtitle="Opens in your browser"
          onPress={() => openURL('https://park-city.in/privacy')}
          showDivider
        />
        <ListRow
          icon="reader-outline"
          label="Terms of Use"
          subtitle="Opens in your browser"
          onPress={() => openURL('https://park-city.in/terms')}
        />
      </View>

      <View style={styles.disclaimerBox}>
        <Ionicons
          name="information-circle-outline"
          size={18}
          color={colors.textSecondary}
        />
        <Text style={styles.disclaimerText}>
          Information provided as-is. Verify signage on-site before parking.
        </Text>
      </View>

      <Text style={styles.sectionLabel}>YOUR DATA</Text>
      <View style={styles.card}>
        <ListRow
          icon="download-outline"
          label="Download My Data"
          onPress={() => void downloadData()}
          showDivider
        />
        <ListRow
          icon="trash-outline"
          label="Delete My Account"
          onPress={deleteAccount}
          destructive
        />
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
    disclaimerBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      marginTop: 12,
      padding: 12,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceMuted,
    },
    disclaimerText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 20,
    },
  })
