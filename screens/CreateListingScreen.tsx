
import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../App'
import { useTheme } from '../contexts/ThemeContext'
import { useDialog } from '../contexts/DialogContext'
import { API_BASE_URL } from '../lib/api'
import { supabase } from '../lib/supabase'
import { spacing, fontWeight } from '../constants/tokens'

type Nav = NativeStackNavigationProp<RootStackParamList>

export default function CreateListingScreen() {
  const { colors } = useTheme()
  const { showDialog } = useDialog()
  const navigation = useNavigation<Nav>()

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [price, setPrice] = useState('')
  const [hours, setHours] = useState('')
  const [capacity, setCapacity] = useState('')
  const [photoUris, setPhotoUris] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    })
    if (!result.canceled && photoUris.length < 3) {
      setPhotoUris((prev) => [...prev, result.assets[0].uri])
    }
  }

  const uploadPhoto = async (
    uri: string,
    userId: string,
    spotName: string,
    index: number,
  ): Promise<string> => {
    const ext = uri.split('.').pop() ?? 'jpg'
    const path = `${userId}/${spotName.replace(/\s/g, '_')}_${index}.${ext}`

    const response = await fetch(uri)
    const blob = await response.blob()

    const { error } = await supabase.storage
      .from('listing-photos')
      .upload(path, blob, { contentType: `image/${ext}`, upsert: true })

    if (error) throw error
    return supabase.storage.from('listing-photos').getPublicUrl(path).data.publicUrl
  }

  const submit = async () => {
    if (!name || !lat || !lng) {
      showDialog({
        type: 'warning',
        title: 'Required',
        message: 'Name, latitude and longitude are required',
      })
      return
    }
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not logged in')

      const photoUrls = await Promise.all(
        photoUris.map((uri, i) => uploadPhoto(uri, session.user.id, name, i)),
      )

      const res = await fetch(`${API_BASE_URL}/listing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name,
          address: address || null,
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          price_per_hour: price ? parseFloat(price) : null,
          operating_hours: hours || null,
          capacity: capacity ? parseInt(capacity, 10) : null,
          photo_urls: photoUrls,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      showDialog({
        type: 'success',
        title: 'Submitted',
        message: 'Your spot has been submitted for review',
        actions: [
          {
            label: 'OK',
            variant: 'primary',
            onPress: () => navigation.goBack(),
          },
        ],
      })
    } catch (e) {
      showDialog({
        type: 'error',
        title: 'Error',
        message: e instanceof Error ? e.message : 'Something went wrong',
      })
    } finally {
      setLoading(false)
    }
  }

  type Field = {
    label: string
    value: string
    onChange: (v: string) => void
    keyboard?: 'default' | 'numeric' | 'decimal-pad'
  }

  const fields: Field[] = [
    { label: 'Spot Name *', value: name, onChange: setName },
    { label: 'Address', value: address, onChange: setAddress },
    { label: 'Latitude *', value: lat, onChange: setLat, keyboard: 'decimal-pad' },
    { label: 'Longitude *', value: lng, onChange: setLng, keyboard: 'decimal-pad' },
    { label: 'Price per hour (₹)', value: price, onChange: setPrice, keyboard: 'decimal-pad' },
    { label: 'Operating Hours (e.g. 8am–10pm)', value: hours, onChange: setHours },
    { label: 'Total Capacity', value: capacity, onChange: setCapacity, keyboard: 'numeric' },
  ]

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Spot Details</Text>

      {fields.map(({ label, value, onChange, keyboard }) => (
        <View key={label} style={styles.fieldRow}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
            value={value}
            onChangeText={onChange}
            keyboardType={keyboard ?? 'default'}
            placeholderTextColor={colors.textSecondary}
          />
        </View>
      ))}

      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
        Photos ({photoUris.length}/3)
      </Text>

      {photoUris.length < 3 && (
        <TouchableOpacity
          style={[styles.photoBtn, { borderColor: colors.border }]}
          onPress={() => void pickPhoto()}
          activeOpacity={0.7}
        >
          <Text style={[styles.photoBtnText, { color: colors.primary }]}>+ Add Photo</Text>
        </TouchableOpacity>
      )}

      {photoUris.map((_, i) => (
        <Text key={i} style={[styles.photoAdded, { color: colors.textSecondary }]}>
          ✓ Photo {i + 1} added
        </Text>
      ))}

      <TouchableOpacity
        style={[styles.submitBtn, { backgroundColor: colors.primary }, loading && { opacity: 0.7 }]}
        onPress={() => void submit()}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.submitText}>Submit for Review</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingBottom: 48,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 10,
  },
  fieldRow: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
  },
  photoBtn: {
    borderWidth: 1,
    borderRadius: 10,
    borderStyle: 'dashed',
    padding: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  photoBtnText: {
    fontSize: 14,
    fontWeight: fontWeight.semibold,
  },
  photoAdded: {
    fontSize: 13,
    marginBottom: 6,
  },
  submitBtn: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
  },
  submitText: {
    color: '#fff',
    fontWeight: fontWeight.bold,
    fontSize: 16,
  },
})
