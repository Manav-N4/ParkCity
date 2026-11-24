
import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../App'
import { useTheme } from '../contexts/ThemeContext'
import { useDialog } from '../contexts/DialogContext'
import { API_BASE_URL } from '../lib/api'
import { supabase } from '../lib/supabase'
import { isAdminEmail } from '../lib/adminAccess'
import { useKeyboardAwareScroll } from '../hooks/useKeyboardAwareScroll'
import VerificationBadge from '../components/VerificationBadge'
import SkeletonCard from '../components/ui/SkeletonCard'
import ListRow from '../components/ui/ListRow'
import PrimaryButton from '../components/ui/PrimaryButton'
import type { VerificationTier } from '../types/parking'
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

type Spot = {
  id: string
  name: string
  address: string | null
  ownership_status: string
  verification_tier: VerificationTier
}

type Profile = {
  id: string
  name: string
  email: string
  avatar_url: string | null
  created_at: string
}

const AVATAR_SIZE = 88

export default function ProfileScreen() {
  const { colors } = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const insets = useSafeAreaInsets()
  const keyboard = useKeyboardAwareScroll()
  const { showDialog } = useDialog()
  const navigation = useNavigation<Nav>()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [listings, setListings] = useState<Spot[]>([])
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [listingsLoading, setListingsLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)

  // Fast admin check from local session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAdmin(isAdminEmail(session?.user?.email))
    }).catch(() => {})
  }, [])

  const loadProfile = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      setIsAdmin(isAdminEmail(session.user.email))

      const res = await fetch(`${API_BASE_URL}/profile/${session.user.id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      let data = null
      if (res.ok) {
        data = await res.json()
      } else {
        console.warn('profile fetch failed:', res.status)
      }

      const avatarWithBust = data?.avatar_url
        ? `${data.avatar_url}?t=${Date.now()}`
        : null

      setProfile({
        id: data?.id ?? session.user.id,
        name: data?.name ?? 'ParkCity User',
        email: session.user.email ?? '',
        avatar_url: avatarWithBust,
        created_at: data?.created_at ?? '',
      })
      setNameInput(data?.name ?? 'ParkCity User')
    } catch (e) {
      console.error('load profile error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadListings = useCallback(async () => {
    setListingsLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch(`${API_BASE_URL}/profile/listings`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      setListings(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('load listings error:', e)
    } finally {
      setListingsLoading(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void loadProfile()
      void loadListings()
    }, [loadProfile, loadListings]),
  )

  const saveName = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch(`${API_BASE_URL}/profile/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name: nameInput }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setProfile((p) => p ? { ...p, name: nameInput } : p)
      setEditingName(false)

      showDialog({
        type: 'success',
        title: 'Name updated',
        message: 'Your name has been updated successfully.',
      })
    } catch (e) {
      showDialog({
        type: 'error',
        title: 'Update failed',
        message: e instanceof Error ? e.message : 'Could not save name.',
      })
    }
  }

  const changeAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1] as [number, number],
      quality: 0.8,
    })

    if (result.canceled) return

    setAvatarLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const uri = result.assets[0].uri

      // Fixed path so re-upload always replaces the same object in the bucket
      const path = `${session.user.id}/avatar.jpg`

      const response = await fetch(uri)
      const blob = await response.blob()

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: true })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)

      // Clean URL stored in DB, busted URL shown in UI
      const cleanUrl = urlData.publicUrl
      const displayUrl = `${cleanUrl}?t=${Date.now()}`

      await fetch(`${API_BASE_URL}/profile/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ avatar_url: cleanUrl }),
      })

      setProfile((p) => p ? { ...p, avatar_url: displayUrl } : p)
    } catch (e) {
      showDialog({
        type: 'error',
        title: 'Avatar update failed',
        message: e instanceof Error ? e.message : 'Could not update avatar.',
      })
    } finally {
      setAvatarLoading(false)
    }
  }

  const signOut = () => {
    showDialog({
      type: 'confirmation',
      title: 'Sign out?',
      message: 'Are you sure you want to sign out of ParkCity?',
      actions: [
        {
          label: 'Cancel',
          variant: 'secondary',
        },
        {
          label: 'Sign out',
          variant: 'destructive',
          onPress: async () => {
            setSigningOut(true)
            try {
              const { error } = await supabase.auth.signOut()
              if (error) throw error

              navigation.reset({
                index: 0,
                routes: [{ name: 'MainTabs' }],
              })
            } catch {
              showDialog({
                type: 'error',
                title: 'Sign out failed',
                message: 'Could not sign out. Please try again.',
              })
            } finally {
              setSigningOut(false)
            }
          },
        },
      ],
    })
  }

  const initials = profile?.name
    ?.split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('') ?? '?'

  return (
    <ScrollView
      ref={keyboard.scrollRef}
      onScroll={keyboard.handleScroll}
      scrollEventThrottle={16}
      style={styles.screen}
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: insets.top + spacing.md,
          paddingBottom: spacing.xl + keyboard.keyboardHeight,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.screenTitle}>Profile</Text>

      {/* Avatar + Name */}
      <View style={styles.headerCard}>
        <Pressable
          onPress={() => void changeAvatar()}
          disabled={avatarLoading}
          accessibilityRole="button"
          accessibilityLabel="Change profile photo"
          style={({ pressed }) => [styles.avatarWrap, pressed && styles.pressed]}
        >
          {avatarLoading ? (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>
                {loading ? '' : initials}
              </Text>
            </View>
          )}

          <View style={styles.cameraBadge}>
            <Ionicons name="camera" size={14} color={colors.white} />
          </View>
        </Pressable>

        {editingName ? (
          <View style={styles.nameEditRow}>
            <TextInput
              style={styles.nameInput}
              value={nameInput}
              onChangeText={setNameInput}
              autoFocus
              onFocus={keyboard.revealOnFocus}
              accessibilityLabel="Your name"
            />
            <Pressable
              onPress={() => void saveName()}
              style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Save name"
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => setEditingName(true)}
            style={({ pressed }) => [styles.nameRow, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Edit your name"
            hitSlop={6}
          >
            <Text style={styles.name} numberOfLines={2}>
              {loading ? 'Loading…' : (profile?.name ?? 'Your Name')}
            </Text>
            <Ionicons
              name="create-outline"
              size={17}
              color={colors.textSecondary}
            />
          </Pressable>
        )}

        {!!profile?.email && (
          <Text style={styles.email}>{profile.email}</Text>
        )}

        {!!profile?.created_at && (
          <Text style={styles.joined}>
            Joined{' '}
            {new Date(profile.created_at).toLocaleDateString('en-IN', {
              month: 'long',
              year: 'numeric',
            })}
          </Text>
        )}
      </View>

      {/* My Listings */}
      <Text style={styles.sectionLabel}>MY LISTINGS</Text>

      {listingsLoading ? (
        <View>
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : listings.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>
            You haven't listed any parking spots yet.
          </Text>
          <ListRow
            icon="add-circle-outline"
            label="List a Parking Spot"
            onPress={() => navigation.navigate('CreateListing')}
          />
        </View>
      ) : (
        <View style={styles.card}>
          {listings.map((spot) => (
            <Pressable
              key={spot.id}
              onPress={() => navigation.navigate('SpotDetail', { spotId: spot.id })}
              style={({ pressed }) => [
                styles.listingRow,
                pressed && { backgroundColor: colors.surfaceMuted },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Open ${spot.name}`}
            >
              <View style={styles.listingText}>
                <Text style={styles.listingName} numberOfLines={1}>
                  {spot.name}
                </Text>
                {spot.address && (
                  <Text style={styles.listingAddress} numberOfLines={1}>
                    {spot.address}
                  </Text>
                )}
              </View>

              {spot.ownership_status === 'pending' ? (
                <View style={styles.pendingChip}>
                  <Text style={styles.pendingChipText}>Pending review</Text>
                </View>
              ) : (
                <VerificationBadge tier={spot.verification_tier} />
              )}
            </Pressable>
          ))}

          <ListRow
            icon="add-circle-outline"
            label="Add Another Spot"
            onPress={() => navigation.navigate('CreateListing')}
            showDivider
          />

          <ListRow
            icon="stats-chart-outline"
            label="Manage availability"
            subtitle="Views, navigations and available slots"
            onPress={() => navigation.navigate('MyListings')}
          />
        </View>
      )}

      {/* Account actions */}
      <Text style={styles.sectionLabel}>ACCOUNT</Text>

      <View style={styles.card}>
        <ListRow
          icon="settings-outline"
          label="Settings"
          onPress={() => navigation.navigate('Settings')}
          showDivider
        />

        <ListRow
          icon="shield-checkmark-outline"
          label="Privacy & Legal"
          onPress={() => navigation.navigate('Legal')}
          showDivider={isAdmin}
        />

        {isAdmin && (
          <ListRow
            icon="card-outline"
            label="Merchant Payments"
            subtitle="Admin only"
            onPress={() => navigation.navigate('AdminPayments')}
          />
        )}
      </View>

      <PrimaryButton
        title="Sign Out"
        variant="destructiveOutline"
        onPress={signOut}
        loading={signingOut}
        disabled={signingOut}
        style={styles.signOutButton}
      />
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
    },
    pressed: {
      opacity: 0.75,
    },
    screenTitle: {
      color: colors.text,
      fontSize: typography.title,
      lineHeight: typography.titleLineHeight,
      fontWeight: fontWeight.bold,
      letterSpacing: letterSpacing.tight,
      marginBottom: spacing.md,
    },

    // Header card
    headerCard: {
      alignItems: 'center',
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.md,
      borderRadius: radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      ...shadow.sm,
    },
    avatarWrap: {
      marginBottom: 12,
    },
    avatar: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2,
      borderWidth: 2,
      borderColor: colors.champagne,
    },
    avatarPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.champagneSoft,
    },
    avatarInitial: {
      color: colors.goldDeep,
      fontSize: 32,
      fontWeight: fontWeight.bold,
    },
    cameraBadge: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.primary,
      borderWidth: 2,
      borderColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      maxWidth: '100%',
    },
    name: {
      flexShrink: 1,
      color: colors.text,
      fontSize: 21,
      lineHeight: 27,
      fontWeight: fontWeight.bold,
      textAlign: 'center',
    },
    nameEditRow: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'stretch',
      gap: spacing.sm,
    },
    nameInput: {
      flex: 1,
      minHeight: 46,
      paddingHorizontal: 14,
      borderRadius: radius.lg,
      borderWidth: 1.5,
      borderColor: colors.primary,
      backgroundColor: colors.surface,
      color: colors.text,
      fontSize: 17,
    },
    saveButton: {
      minHeight: 46,
      paddingHorizontal: 18,
      borderRadius: radius.pill,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveButtonText: {
      color: colors.white,
      fontSize: 15,
      fontWeight: fontWeight.semibold,
    },
    email: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginTop: 6,
    },
    joined: {
      color: colors.textSecondary,
      fontSize: typography.caption,
      marginTop: 3,
    },

    // Sections
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
    emptyText: {
      color: colors.textSecondary,
      fontSize: typography.small,
      lineHeight: typography.smallLineHeight,
      paddingHorizontal: spacing.md,
      paddingTop: 14,
    },
    listingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    listingText: {
      flex: 1,
      minWidth: 0,
    },
    listingName: {
      color: colors.text,
      fontSize: 15,
      lineHeight: 20,
      fontWeight: fontWeight.semibold,
    },
    listingAddress: {
      color: colors.textSecondary,
      fontSize: typography.caption,
      lineHeight: 17,
      marginTop: 2,
    },
    pendingChip: {
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: radius.pill,
      backgroundColor: colors.champagneSoft,
    },
    pendingChipText: {
      color: colors.goldDeep,
      fontSize: 11,
      fontWeight: fontWeight.semibold,
    },
    signOutButton: {
      marginTop: spacing.lg,
      // Solid surface so the red label keeps AA contrast (ivory alone is 4.3:1).
      backgroundColor: colors.surface,
    },
  })
