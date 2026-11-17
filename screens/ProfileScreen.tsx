
import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../App'
import { useTheme } from '../contexts/ThemeContext'
import { API_BASE_URL } from '../lib/api'
import { supabase } from '../lib/supabase'
import VerificationBadge from '../components/VerificationBadge'
import SkeletonCard from '../components/ui/SkeletonCard'
import type { VerificationTier } from '../types/parking'
import { spacing, fontWeight } from '../constants/tokens'

type Nav = NativeStackNavigationProp<RootStackParamList>

const ADMIN_EMAIL = 'nayakmanav04@gmail.com'

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

export default function ProfileScreen() {
  const { colors } = useTheme()
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
      setIsAdmin(session?.user?.email === ADMIN_EMAIL)
    }).catch(() => {})
  }, [])

  const loadProfile = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      setIsAdmin(session.user.email === ADMIN_EMAIL)

      const res = await fetch(`${API_BASE_URL}/profile/${session.user.id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      let data = null
      if (res.ok) {
        data = await res.json()
      } else {
        console.warn('profile fetch failed:', res.status)
      }

      const avatarWithBust = data?.avatar_url ? `${data.avatar_url}?t=${Date.now()}` : null
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
      Alert.alert('Saved', 'Your name has been updated')
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save name')
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
      const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg'
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
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not update avatar')
    } finally {
      setAvatarLoading(false)
    }
  }

  const signOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out of ParkCity?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true)
          try {
            await supabase.auth.signOut()
            navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] })
          } catch (e) {
            Alert.alert('Error', 'Could not sign out. Try again.')
          } finally {
            setSigningOut(false)
          }
        },
      },
    ])
  }

  const initials = profile?.name
    ?.split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('') ?? '?'

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Avatar + Name */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => void changeAvatar()} disabled={avatarLoading}>
          {avatarLoading ? (
            <ActivityIndicator style={styles.avatar} color={colors.primary} />
          ) : profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: colors.surface }]}>
              <Text style={[styles.avatarInitial, { color: colors.primary }]}>
                {loading ? '' : initials}
              </Text>
            </View>
          )}
          <Text style={[styles.changePhoto, { color: colors.primary }]}>Change Photo</Text>
        </TouchableOpacity>

        {editingName ? (
          <View style={styles.nameRow}>
            <TextInput
              style={[styles.nameInput, { color: colors.text, borderColor: colors.border }]}
              value={nameInput}
              onChangeText={setNameInput}
              autoFocus
            />
            <TouchableOpacity onPress={() => void saveName()}>
              <Text style={[styles.saveBtn, { color: colors.primary }]}>Save</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setEditingName(true)}>
            <Text style={[styles.name, { color: colors.text }]}>
              {loading ? 'Loading…' : (profile?.name ?? 'Your Name')}
            </Text>
            <Text style={[styles.editHint, { color: colors.textSecondary }]}>Tap to edit</Text>
          </TouchableOpacity>
        )}

        <Text style={[styles.email, { color: colors.textSecondary }]}>{profile?.email}</Text>
        {profile?.created_at && (
          <Text style={[styles.joined, { color: colors.textSecondary }]}>
            Joined{' '}
            {new Date(profile.created_at).toLocaleDateString('en-IN', {
              month: 'long',
              year: 'numeric',
            })}
          </Text>
        )}
      </View>

      {/* My Listings */}
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>My Listings</Text>
      {listingsLoading ? (
        <View style={{ paddingHorizontal: spacing.md }}>
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : listings.length === 0 ? (
        <>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            You haven't listed any parking spots yet.
          </Text>
          <TouchableOpacity
            style={[styles.actionRow, { backgroundColor: colors.surface, borderColor: colors.border, marginHorizontal: spacing.md }]}
            onPress={() => navigation.navigate('CreateListing')}
            activeOpacity={0.75}
          >
            <Text style={[styles.actionLabel, { color: colors.primary }]}>+ List a Parking Spot</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          {listings.map((spot) => (
            <TouchableOpacity
              key={spot.id}
              style={[styles.listingRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => navigation.navigate('SpotDetail', { spotId: spot.id })}
              activeOpacity={0.75}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.listingName, { color: colors.text }]}>{spot.name}</Text>
                {spot.address && (
                  <Text style={[styles.listingAddress, { color: colors.textSecondary }]}>
                    {spot.address}
                  </Text>
                )}
              </View>
              {spot.ownership_status === 'pending' ? (
                <Text style={[styles.pendingBadge, { color: colors.warning }]}>Pending review</Text>
              ) : (
                <VerificationBadge tier={spot.verification_tier} />
              )}
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.actionRow, { backgroundColor: colors.surface, borderColor: colors.border, marginHorizontal: spacing.md }]}
            onPress={() => navigation.navigate('CreateListing')}
            activeOpacity={0.75}
          >
            <Text style={[styles.actionLabel, { color: colors.primary }]}>+ Add Another Spot</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Account actions */}
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Account</Text>

      <TouchableOpacity
        style={[styles.actionRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => navigation.navigate('Settings')}
        activeOpacity={0.75}
      >
        <Text style={[styles.actionLabel, { color: colors.text }]}>Settings</Text>
        <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => navigation.navigate('Legal')}
        activeOpacity={0.75}
      >
        <Text style={[styles.actionLabel, { color: colors.text }]}>Privacy & Legal</Text>
        <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
      </TouchableOpacity>

      {isAdmin && (
        <TouchableOpacity
          style={[styles.actionRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => navigation.navigate('AdminPayments')}
          activeOpacity={0.75}
        >
          <Text style={[styles.actionLabel, { color: colors.text }]}>Merchant Payments</Text>
          <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.actionRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={signOut}
        disabled={signingOut}
        activeOpacity={0.75}
      >
        {signingOut ? (
          <ActivityIndicator color={colors.error} />
        ) : (
          <Text style={[styles.actionLabel, { color: colors.error }]}>Sign Out</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 48,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: spacing.lg,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 8,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 32,
    fontWeight: fontWeight.bold,
  },
  changePhoto: {
    fontSize: 13,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
    marginBottom: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    fontSize: 18,
    minWidth: 160,
  },
  saveBtn: {
    fontSize: 15,
    fontWeight: fontWeight.bold,
  },
  name: {
    fontSize: 20,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
  },
  editHint: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
  },
  email: {
    fontSize: 14,
    marginTop: 6,
  },
  joined: {
    fontSize: 12,
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 24,
    marginBottom: 8,
    marginLeft: spacing.lg,
  },
  emptyText: {
    fontSize: 14,
    marginHorizontal: spacing.lg,
    marginBottom: 8,
  },
  listingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: spacing.md,
    marginBottom: 8,
  },
  listingName: {
    fontSize: 15,
    fontWeight: fontWeight.semibold,
  },
  listingAddress: {
    fontSize: 12,
    marginTop: 2,
  },
  pendingBadge: {
    fontSize: 12,
    fontWeight: fontWeight.semibold,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: spacing.md,
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 15,
  },
  chevron: {
    fontSize: 18,
  },
})
