
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../App';
import { useTheme } from '../contexts/ThemeContext';
import PrimaryButton from '../components/ui/PrimaryButton';
import { supabase } from '../lib/supabase';
import { API_BASE_URL } from '../lib/api';
import {
  fontWeight,
  radius,
  spacing,
  typography,
} from '../constants/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'ClaimSpot'>;

type ClaimPhoto = {
  uri: string;
  latitude: number | null;
  longitude: number | null;
};

const PHOTO_TYPES = [
  { key: 'entry', label: 'Entry photo' },
  { key: 'signage', label: 'Signage photo' },
  { key: 'wide', label: 'Wide shot' },
] as const;

function getGpsValue(
  value: unknown,
  reference: unknown,
): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  const ref =
    typeof reference === 'string' ? reference.toUpperCase() : '';

  return ref === 'S' || ref === 'W' ? -Math.abs(value) : value;
}

export default function ClaimSpotScreen({ route, navigation }: Props) {
  const { spot } = route.params;
  const { colors } = useTheme();

  const [step, setStep] = useState(1);
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [contact, setContact] = useState('');
  const [photos, setPhotos] = useState<(ClaimPhoto | null)[]>([
    null,
    null,
    null,
  ]);
  const [price, setPrice] = useState('');
  const [operatingHours, setOperatingHours] = useState('');
  const [capacity, setCapacity] = useState('');
  const [loading, setLoading] = useState(false);

  const takePhoto = async (index: number) => {
    try {
      const permission =
        await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Camera permission required',
          'Allow camera access in your device settings to photograph this parking spot.',
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        cameraType: ImagePicker.CameraType.back,
        allowsEditing: false,
        quality: 0.8,
        exif: true,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];
      const exif = asset.exif ?? {};

      const latitude = getGpsValue(
        exif.GPSLatitude,
        exif.GPSLatitudeRef,
      );
      const longitude = getGpsValue(
        exif.GPSLongitude,
        exif.GPSLongitudeRef,
      );

      setPhotos((current) => {
        const next = [...current];
        next[index] = {
          uri: asset.uri,
          latitude: index === 0 ? latitude : null,
          longitude: index === 0 ? longitude : null,
        };
        return next;
      });
    } catch (error) {
      console.error('Camera capture failed:', error);
      Alert.alert('Camera error', 'Could not capture this photo.');
    }
  };

  const validateStep = () => {
    if (step === 1) {
      if (!businessName.trim() || !ownerName.trim() || !contact.trim()) {
        Alert.alert(
          'Missing information',
          'Enter the business name, owner name and contact number.',
        );
        return false;
      }

      return true;
    }

    if (step === 2) {
      if (photos.some((photo) => photo === null)) {
        Alert.alert(
          'Three photos required',
          'Capture the entry, signage and wide-shot photos before continuing.',
        );
        return false;
      }

      return true;
    }

    if (
      !price.trim() ||
      !operatingHours.trim() ||
      !capacity.trim() ||
      !Number.isFinite(Number(price)) ||
      !Number.isFinite(Number(capacity)) ||
      Number(price) < 0 ||
      Number(capacity) < 1
    ) {
      Alert.alert(
        'Check spot details',
        'Enter a valid hourly price, operating hours and capacity.',
      );
      return false;
    }

    return true;
  };

  const uploadPhoto = async (
    uri: string,
    userId: string,
    timestamp: number,
  ): Promise<string> => {
    const response = await fetch(uri);

    if (!response.ok) {
      throw new Error('Could not read a captured photo.');
    }

    const fileData = await response.arrayBuffer();
    const path = `${userId}/${spot.id}/${timestamp}.jpg`;

    const { error } = await supabase.storage
      .from('claim-photos')
      .upload(path, fileData, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) {
      throw new Error(`Photo upload failed: ${error.message}`);
    }

    const { data } = supabase.storage
      .from('claim-photos')
      .getPublicUrl(path);

    return data.publicUrl;
  };

  const submitClaim = async () => {
    if (!validateStep()) {
      return;
    }

    setLoading(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.user) {
        throw new Error('Please sign in before submitting a claim.');
      }

      const capturedPhotos = photos as ClaimPhoto[];
      const photoUrls: string[] = [];

      for (let index = 0; index < capturedPhotos.length; index += 1) {
        const photo = capturedPhotos[index];
        const timestamp = Date.now() + index;

        const url = await uploadPhoto(
          photo.uri,
          session.user.id,
          timestamp,
        );

        photoUrls.push(url);
      }

      const firstPhoto = capturedPhotos[0];

      const response = await fetch(`${API_BASE_URL}/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          spot_id: spot.id,
          ownership_details: {
            business_name: businessName.trim(),
            owner_name: ownerName.trim(),
            contact: contact.trim(),
          },
          photo_urls: photoUrls,
          photo_lat: firstPhoto.latitude,
          photo_lng: firstPhoto.longitude,
          price_per_hour: Number(price),
          operating_hours: operatingHours.trim(),
          capacity: Number(capacity),
        }),
      });

      const responseText = await response.text();
      let responseBody: { error?: string; message?: string } = {};

      try {
        responseBody = responseText ? JSON.parse(responseText) : {};
      } catch {
        // Keep a useful fallback for non-JSON server responses.
      }

      if (!response.ok) {
        throw new Error(
          responseBody.error ||
            responseBody.message ||
            `Claim submission failed (${response.status}).`,
        );
      }

      Alert.alert(
        'Claim submitted',
        'Your parking spot claim has been submitted.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (error) {
      console.error('Claim submission failed:', error);
      Alert.alert(
        'Could not submit claim',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const field = (
    label: string,
    value: string,
    onChangeText: (value: string) => void,
    options?: {
      placeholder?: string;
      keyboardType?: 'default' | 'numeric' | 'phone-pad';
    },
  ) => (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={options?.placeholder ?? label}
        placeholderTextColor={colors.textSecondary}
        keyboardType={options?.keyboardType ?? 'default'}
        style={[
          styles.input,
          {
            backgroundColor: colors.surface,
            color: colors.text,
            borderColor: colors.border,
          },
        ]}
      />
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={[styles.backText, { color: colors.text }]}>
            ← Back to spot
          </Text>
        </Pressable>

        <Text style={[styles.heading, { color: colors.text }]}>
          Claim this spot
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {spot.name}
        </Text>

        <View style={styles.stepRow}>
          {['Ownership', 'Photos', 'Spot details'].map((label, index) => {
            const number = index + 1;
            const active = number === step;
            const complete = number < step;

            return (
              <View key={label} style={styles.stepItem}>
                <View
                  style={[
                    styles.stepCircle,
                    {
                      backgroundColor:
                        active || complete
                          ? colors.primary
                          : colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color:
                        active || complete
                          ? '#FFFFFF'
                          : colors.textSecondary,
                      fontWeight: fontWeight.semibold,
                    }}
                  >
                    {complete ? '✓' : number}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    {
                      color: active ? colors.text : colors.textSecondary,
                    },
                  ]}
                >
                  {label}
                </Text>
              </View>
            );
          })}
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          {step === 1 && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Ownership details
              </Text>
              {field('Business name', businessName, setBusinessName)}
              {field('Owner name', ownerName, setOwnerName)}
              {field('Contact number', contact, setContact, {
                keyboardType: 'phone-pad',
                placeholder: 'Enter contact number',
              })}
            </>
          )}

          {step === 2 && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Photograph the parking spot
              </Text>
              <Text style={[styles.hint, { color: colors.textSecondary }]}>
                Use the camera to capture all three views. Gallery selection
                is not used.
              </Text>

              {PHOTO_TYPES.map((item, index) => (
                <View
                  key={item.key}
                  style={[
                    styles.photoRow,
                    { borderColor: colors.border },
                  ]}
                >
                  <View style={styles.photoText}>
                    <Text style={[styles.label, { color: colors.text }]}>
                      {item.label}
                    </Text>
                    <Text
                      style={{ color: colors.textSecondary, fontSize: 13 }}
                    >
                      {photos[index] ? 'Photo captured' : 'Photo required'}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => takePhoto(index)}
                    style={[
                      styles.photoButton,
                      { backgroundColor: colors.primary },
                    ]}
                  >
                    <Text style={styles.photoButtonText}>
                      {photos[index] ? 'Retake' : 'Open camera'}
                    </Text>
                  </Pressable>
                </View>
              ))}

              <Text style={[styles.hint, { color: colors.textSecondary }]}>
                GPS: {photos[0]?.latitude != null &&
                photos[0]?.longitude != null
                  ? `${photos[0].latitude}, ${photos[0].longitude}`
                  : 'Unavailable in the first photo'}
              </Text>
            </>
          )}

          {step === 3 && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Spot details
              </Text>
              {field('Price per hour (₹)', price, setPrice, {
                keyboardType: 'numeric',
              })}
              {field('Operating hours', operatingHours, setOperatingHours, {
                placeholder: 'e.g. 8am–10pm',
              })}
              {field('Capacity', capacity, setCapacity, {
                keyboardType: 'numeric',
                placeholder: 'Number of vehicles',
              })}
            </>
          )}
        </View>

        {step > 1 && (
          <Pressable
            onPress={() => setStep((current) => current - 1)}
            disabled={loading}
            style={styles.previousButton}
          >
            <Text style={[styles.previousText, { color: colors.text }]}>
              Previous step
            </Text>
          </Pressable>
        )}

        {step < 3 ? (
          <PrimaryButton
            title="Continue"
            onPress={() => {
              if (validateStep()) {
                setStep((current) => current + 1);
              }
            }}
          />
        ) : (
          <PrimaryButton
            title="Submit claim"
            loading={loading}
            onPress={submitClaim}
          />
        )}

        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ color: colors.textSecondary }}>
              Uploading photos and submitting claim…
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.xl * 1.5,
    paddingBottom: spacing.xl * 2,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  backText: {
    fontSize: typography.body,
    fontWeight: fontWeight.medium,
  },
  heading: {
    fontSize: typography.heading,
    fontWeight: fontWeight.bold,
  },
  subtitle: {
    fontSize: typography.body,
    marginTop: spacing.xs,
  },
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: spacing.xl,
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
  },
  stepCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.md,
  },
  field: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.small,
    fontWeight: fontWeight.medium,
    marginBottom: spacing.xs,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.body,
  },
  hint: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: spacing.md,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  photoText: {
    flex: 1,
  },
  photoButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  photoButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: fontWeight.semibold,
  },
  previousButton: {
    alignSelf: 'center',
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  previousText: {
    fontWeight: fontWeight.medium,
  },
  loadingRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
