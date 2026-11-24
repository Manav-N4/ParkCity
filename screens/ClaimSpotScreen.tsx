
import { useMemo, useRef, useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../App';
import { useTheme } from '../contexts/ThemeContext';
import { useDialog } from '../contexts/DialogContext';
import PrimaryButton from '../components/ui/PrimaryButton';
import TimeSelect from '../components/ui/TimeSelect';
import { useKeyboardAwareScroll } from '../hooks/useKeyboardAwareScroll';
import {
  isValidBusinessName,
  isValidCapacity,
  isValidOwnerName,
  isValidPhone,
  isValidPrice,
  sanitizeBusinessName,
  sanitizeCapacity,
  sanitizeOwnerName,
  sanitizePhone,
  sanitizePrice,
} from '../lib/formValidation';
import {
  LOCATION_RULES,
  resolveReliableLocation,
  withTimeout,
  type LocationProblem,
} from '../lib/locationQuality';
import { supabase } from '../lib/supabase';
import { API_BASE_URL } from '../lib/api';
import {
  colors as lightColors,
  fontWeight,
  letterSpacing,
  radius,
  shadow,
  spacing,
  typography,
} from '../constants/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'ClaimSpot'>;

type ClaimPhoto = {
  uri: string;
  latitude: number | null;
  longitude: number | null;
  // Display only; not part of the claim payload.
  accuracy: number | null;
};

const PHOTO_TYPES = [
  { key: 'entry', label: 'Entry photo' },
  { key: 'signage', label: 'Signage photo' },
  { key: 'wide', label: 'Wide shot' },
] as const;

const STEP_LABELS = ['Ownership', 'Photos', 'Spot details'];

type IoniconName = keyof typeof Ionicons.glyphMap;

// Display-only icons for each existing photo slot.
const PHOTO_ICONS: Record<(typeof PHOTO_TYPES)[number]['key'], IoniconName> = {
  entry: 'enter-outline',
  signage: 'reader-outline',
  wide: 'scan-outline',
};

// #region form-helpers
// Operating-hours helpers and photo-slot helper. Other input rules live in
// lib/formValidation.ts.

function formatOperatingHours(
  isOpen24Hours: boolean,
  openTime: string | null,
  closeTime: string | null,
) {
  if (isOpen24Hours) return 'Open 24 hours';
  if (openTime && closeTime) return `${openTime} – ${closeTime}`;
  return '';
}

function isValidOperatingHours(
  isOpen24Hours: boolean,
  openTime: string | null,
  closeTime: string | null,
) {
  if (isOpen24Hours) return true;
  return Boolean(openTime && closeTime && openTime !== closeTime);
}

// Places a captured photo in its slot. Coordinates are only ever stored on
// the entry photo (slot 0) and always come from that same capture.
function withCapturedPhoto(
  current: ({ uri: string; latitude: number | null; longitude: number | null; accuracy: number | null } | null)[],
  index: number,
  uri: string,
  location: { latitude: number; longitude: number; accuracy: number } | null,
) {
  const next = [...current];
  const isEntryPhoto = index === 0;

  next[index] = {
    uri,
    latitude: isEntryPhoto && location ? location.latitude : null,
    longitude: isEntryPhoto && location ? location.longitude : null,
    accuracy: isEntryPhoto && location ? location.accuracy : null,
  };

  return next;
}
// #endregion form-helpers

type FieldKey =
  | 'businessName'
  | 'ownerName'
  | 'contact'
  | 'price'
  | 'operatingHours'
  | 'capacity';

type FieldErrors = Partial<Record<FieldKey, string>>;

const FIELD_NAMES: Record<FieldKey, string> = {
  businessName: 'business name',
  ownerName: 'owner name',
  contact: 'contact number',
  price: 'price per hour',
  operatingHours: 'operating hours',
  capacity: 'capacity',
};

export default function ClaimSpotScreen({ route, navigation }: Props) {
  const { spot } = route.params;
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardAwareScroll();
  const { showDialog } = useDialog();

  // Display-only: which input currently shows the focus border.
  const [focusedField, setFocusedField] = useState<string | null>(null);

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
  const [openTime, setOpenTime] = useState<string | null>(null);
  const [closeTime, setCloseTime] = useState<string | null>(null);
  const [isOpen24Hours, setIsOpen24Hours] = useState(false);
  const [capacity, setCapacity] = useState('');
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isLocating, setIsLocating] = useState(false);

  // Sent as operating_hours, e.g. "8:00 AM – 10:00 PM" or "Open 24 hours".
  const operatingHours = formatOperatingHours(
    isOpen24Hours,
    openTime,
    closeTime,
  );

  const clearFieldError = (key: FieldKey) => {
    setFieldErrors((current) =>
      current[key] ? { ...current, [key]: undefined } : current,
    );
  };

  const describeErrors = (errors: FieldErrors) =>
    (Object.keys(errors) as FieldKey[])
      .filter((key) => errors[key])
      .map((key) => FIELD_NAMES[key])
      .join(', ');

  // Location is required so the claim can be checked against the spot.
  const ensureLocationPermission = async (): Promise<boolean> => {
    let locationPermission = await Location.getForegroundPermissionsAsync();

    if (!locationPermission.granted && locationPermission.canAskAgain) {
      locationPermission = await Location.requestForegroundPermissionsAsync();
    }

    if (locationPermission.granted) {
      return true;
    }

    showDialog({
      type: 'warning',
      title: 'Location required',
      message:
        "ParkCity needs your location to verify you're at this parking spot. Allow location access to take claim photos.",
      actions: [
        { label: 'Cancel', variant: 'secondary' },
        {
          label: 'Open settings',
          onPress: () => {
            void Linking.openSettings();
          },
        },
      ],
    });

    return false;
  };

  // A fresh high-accuracy fix, or a cached fix that is recent and accurate.
  // See lib/locationQuality.ts for the exact rules.
  const acquireEntryLocation = () =>
    resolveReliableLocation(
      () =>
        withTimeout(
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          }),
          LOCATION_RULES.freshTimeoutMs,
        ),
      () =>
        Location.getLastKnownPositionAsync({
          maxAge: LOCATION_RULES.maxAgeMs,
          requiredAccuracy: LOCATION_RULES.maxAccuracyMeters,
        }),
    );

  const locationProblemMessage = (
    problem: LocationProblem,
    accuracy: number | null,
  ) => {
    if (problem === 'inaccurate') {
      const reported =
        accuracy != null ? ` (about ${Math.round(accuracy)} m)` : '';
      return `Your location isn't precise enough${reported}. It needs to be within ${LOCATION_RULES.maxAccuracyMeters} m. Turn on precise location, move to an open area, then retake the entry photo.`;
    }

    if (problem === 'stale') {
      return "Your phone only had an old location. Wait a moment for a fresh fix, then retake the entry photo.";
    }

    return "We couldn't get your location. Make sure location is on, then retake the entry photo.";
  };

  // Prevents a second capture starting while one is in progress.
  const captureInProgress = useRef(false);

  const takePhoto = async (index: number) => {
    if (captureInProgress.current) {
      return;
    }

    captureInProgress.current = true;

    try {
      const hasLocationPermission = await ensureLocationPermission();

      if (!hasLocationPermission) {
        return;
      }

      if (index === 0) {
        const servicesEnabled = await Location.hasServicesEnabledAsync();

        if (!servicesEnabled) {
          showDialog({
            type: 'warning',
            title: 'Turn on location',
            message:
              'Location services are off. Turn them on so the entry photo can be matched to this parking spot.',
            actions: [
              { label: 'Cancel', variant: 'secondary' },
              {
                label: 'Open settings',
                onPress: () => {
                  void Linking.openSettings();
                },
              },
            ],
          });
          return;
        }
      }

      const permission =
        await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        showDialog({
          type: 'warning',
          title: 'Camera permission required',
          message:
            'Allow camera access in your device settings to photograph this parking spot.',
        });
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        cameraType: ImagePicker.CameraType.back,
        allowsEditing: false,
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];

      // The entry photo gets a fresh location read for this capture, now that
      // the app is back in the foreground. Other photos carry no coordinates.
      let entryLocation: {
        latitude: number;
        longitude: number;
        accuracy: number;
      } | null = null;

      if (index === 0) {
        setIsLocating(true);

        try {
          const locationResult = await acquireEntryLocation();

          if (!locationResult.ok) {
            // The new photo is discarded; any previous entry photo keeps its
            // own coordinates.
            showDialog({
              type: 'warning',
              title: 'Location not reliable',
              message: locationProblemMessage(
                locationResult.problem,
                locationResult.accuracy,
              ),
            });
            return;
          }

          entryLocation = locationResult.location;
        } finally {
          setIsLocating(false);
        }
      }

      setPhotos((current) =>
        withCapturedPhoto(current, index, asset.uri, entryLocation),
      );
    } catch (error) {
      console.error('Camera capture failed:', error);
      showDialog({
        type: 'error',
        title: 'Camera error',
        message: 'Could not capture this photo.',
      });
    } finally {
      captureInProgress.current = false;
    }
  };

  const validateStep = () => {
    if (step === 1) {
      const errors: FieldErrors = {};

      if (!isValidBusinessName(businessName)) {
        errors.businessName = 'Enter the business name (at least 2 characters).';
      }
      if (!isValidOwnerName(ownerName)) {
        errors.ownerName = "Enter the owner's name (letters only, at least 2).";
      }
      if (!isValidPhone(contact)) {
        errors.contact =
          'Enter a 10-digit mobile number starting with 6–9 (without a leading 0).';
      }

      setFieldErrors(errors);

      if (Object.keys(errors).length > 0) {
        showDialog({
          type: 'warning',
          title: 'Missing information',
          message: `Please check the ${describeErrors(errors)}.`,
        });
        return false;
      }

      return true;
    }

    if (step === 2) {
      if (photos.some((photo) => photo === null)) {
        showDialog({
          type: 'warning',
          title: 'Three photos required',
          message:
            'Capture the entry, signage and wide-shot photos before continuing.',
        });
        return false;
      }

      return true;
    }

    const errors: FieldErrors = {};

    if (!isValidPrice(price)) {
      errors.price = 'Enter a price between ₹0 and ₹9999 (up to 2 decimals).';
    }
    if (!isValidOperatingHours(isOpen24Hours, openTime, closeTime)) {
      errors.operatingHours =
        openTime && closeTime && openTime === closeTime
          ? 'Opening and closing times must be different.'
          : 'Select opening and closing times, or turn on Open 24 hours.';
    }
    if (!isValidCapacity(capacity)) {
      errors.capacity = 'Enter a capacity between 1 and 9999 vehicles.';
    }

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      showDialog({
        type: 'warning',
        title: 'Check spot details',
        message: `Please check the ${describeErrors(errors)}.`,
      });
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

    return path;
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

        const path = await uploadPhoto(
          photo.uri,
          session.user.id,
          timestamp,
        );

        photoUrls.push(path);
      }

      const firstPhoto = capturedPhotos[0];

      const claimPayload = {
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
      };

      const response = await fetch(`${API_BASE_URL}/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(claimPayload),
      });

      const responseText = await response.text();

      let responseBody: {
        error?: string;
        message?: string;
      } = {};

      try {
        responseBody = responseText ? JSON.parse(responseText) : {};
      } catch {
        // Preserve the raw response for debugging.
      }

      if (!response.ok) {
        showDialog({
          type: 'error',
          title: 'Claim Debug Information',
          message: [
            `HTTP Status: ${response.status}`,
            '',
            `Spot ID: ${claimPayload.spot_id}`,
            '',
            `Photo count: ${claimPayload.photo_urls.length}`,
            '',
            `Photo paths:\n${claimPayload.photo_urls.join('\n')}`,
            '',
            `Backend response:\n${responseText || 'Empty response'}`,
          ].join('\n'),
        });

        return;
      }

      showDialog({
        type: 'success',
        title: 'Claim submitted',
        message: 'Your parking spot claim has been submitted.',
        actions: [
          {
            label: 'OK',
            variant: 'primary',
            onPress: () => navigation.goBack(),
          },
        ],
      });
    } catch (error) {
      showDialog({
        type: 'error',
        title: 'Could not submit claim',
        message:
          error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const field = (
    key: FieldKey,
    label: string,
    value: string,
    onChangeText: (value: string) => void,
    options?: {
      placeholder?: string;
      keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'phone-pad' | 'number-pad';
      sanitize?: (value: string) => string;
      maxLength?: number;
      prefix?: string;
      suffix?: string;
      autoCapitalize?: 'none' | 'words';
      autoComplete?: 'name' | 'tel-national' | 'off';
      helper?: string;
    },
  ) => {
    const error = fieldErrors[key];
    const isFocused = focusedField === key;

    return (
      <View style={styles.field}>
        <Text style={styles.label}>
          {label}
        </Text>

        <View
          style={[
            styles.inputRow,
            isFocused && styles.inputFocused,
            !!error && styles.inputError,
          ]}
        >
          {options?.prefix && (
            <Text style={styles.inputAffix}>{options.prefix}</Text>
          )}

          <TextInput
            value={value}
            onChangeText={(text) => {
              onChangeText(options?.sanitize ? options.sanitize(text) : text);
              clearFieldError(key);
            }}
            placeholder={options?.placeholder ?? label}
            placeholderTextColor={colors.textSecondary}
            keyboardType={options?.keyboardType ?? 'default'}
            maxLength={options?.maxLength}
            autoCapitalize={options?.autoCapitalize ?? 'sentences'}
            autoComplete={options?.autoComplete}
            autoCorrect={false}
            onFocus={() => {
              setFocusedField(key);
              keyboard.revealOnFocus();
            }}
            onBlur={() =>
              setFocusedField((current) => (current === key ? null : current))
            }
            accessibilityLabel={label}
            style={styles.input}
          />

          {options?.suffix && (
            <Text style={styles.inputAffix}>{options.suffix}</Text>
          )}
        </View>

        {error ? (
          <View style={styles.errorRow}>
            <Ionicons
              name="alert-circle"
              size={13}
              color={colors.errorText}
            />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : options?.helper ? (
          <Text style={styles.helperText}>{options.helper}</Text>
        ) : null}
      </View>
    );
  };

  const hasAddress =
    typeof spot.address === 'string' && spot.address.trim().length > 0;

  return (
    <View style={styles.container}>
      <ScrollView
        ref={keyboard.scrollRef}
        onScroll={keyboard.handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + spacing.sm,
            paddingBottom:
              Math.max(insets.bottom, spacing.md) +
              spacing.xl * 2 +
              keyboard.keyboardHeight,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Back to spot"
          hitSlop={6}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </Pressable>

        <Text style={styles.eyebrow}>CLAIM</Text>

        <Text style={styles.heading}>Claim this spot</Text>

        <View style={styles.spotChip}>
          <Ionicons
            name="location-outline"
            size={14}
            color={colors.textSecondary}
          />
          <Text style={styles.spotChipText} numberOfLines={1}>
            {spot.name}
            {hasAddress ? ` · ${spot.address}` : ''}
          </Text>
        </View>

        {/* Stepper */}
        <View style={styles.stepRow}>
          {STEP_LABELS.map((label, index) => {
            const number = index + 1;
            const active = number === step;
            const complete = number < step;

            return (
              <View key={label} style={styles.stepItem}>
                <View style={styles.stepTrack}>
                  <View
                    style={[
                      styles.stepConnector,
                      index === 0 && styles.stepConnectorHidden,
                      number <= step && styles.stepConnectorDone,
                    ]}
                  />

                  <View
                    style={[
                      styles.stepCircle,
                      active || complete
                        ? styles.stepCircleFilled
                        : styles.stepCircleUpcoming,
                    ]}
                    accessible
                    accessibilityLabel={`Step ${number}, ${label}${
                      complete ? ', complete' : active ? ', current' : ''
                    }`}
                  >
                    {complete ? (
                      <Ionicons
                        name="checkmark"
                        size={16}
                        color={colors.white}
                      />
                    ) : (
                      <Text
                        style={[
                          styles.stepNumber,
                          active
                            ? styles.stepNumberActive
                            : styles.stepNumberUpcoming,
                        ]}
                      >
                        {number}
                      </Text>
                    )}
                  </View>

                  <View
                    style={[
                      styles.stepConnector,
                      index === STEP_LABELS.length - 1 &&
                        styles.stepConnectorHidden,
                      number < step && styles.stepConnectorDone,
                    ]}
                  />
                </View>

                <Text
                  style={[
                    styles.stepLabel,
                    active && styles.stepLabelActive,
                  ]}
                >
                  {label}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={styles.card}>
          {step === 1 && (
            <>
              <Text style={styles.sectionTitle}>Ownership details</Text>
              <Text style={styles.requiredNote}>All fields are required.</Text>
              {field('businessName', 'Business name', businessName, setBusinessName, {
                sanitize: sanitizeBusinessName,
                maxLength: 80,
                autoCapitalize: 'words',
                autoComplete: 'off',
              })}
              {field('ownerName', 'Owner name', ownerName, setOwnerName, {
                sanitize: sanitizeOwnerName,
                maxLength: 60,
                autoCapitalize: 'words',
                autoComplete: 'name',
              })}
              {field('contact', 'Contact number', contact, setContact, {
                keyboardType: 'phone-pad',
                placeholder: '10-digit mobile number',
                sanitize: sanitizePhone,
                prefix: '+91',
                autoComplete: 'tel-national',
                helper: 'Indian mobile number, starting with 6–9.',
              })}
            </>
          )}

          {step === 2 && (
            <>
              <Text style={styles.sectionTitle}>
                Photograph the parking spot
              </Text>
              <Text style={styles.hint}>
                Use the camera to capture all three views. Gallery selection
                is not used. Location access is required to verify you're at
                the spot.
              </Text>

              {PHOTO_TYPES.map((item, index) => {
                const captured = photos[index];

                return (
                  <View
                    key={item.key}
                    style={[
                      styles.photoRow,
                      index === PHOTO_TYPES.length - 1 &&
                        styles.photoRowLast,
                    ]}
                  >
                    {captured ? (
                      <Image
                        source={{ uri: captured.uri }}
                        style={styles.thumbnail}
                        accessibilityLabel={`${item.label} captured`}
                      />
                    ) : (
                      <View style={styles.photoIcon}>
                        <Ionicons
                          name={PHOTO_ICONS[item.key]}
                          size={18}
                          color={colors.goldDeep}
                        />
                      </View>
                    )}

                    <View style={styles.photoText}>
                      <Text style={styles.photoLabel}>
                        {item.label}
                      </Text>
                      <View style={styles.photoStatusRow}>
                        {captured && (
                          <Ionicons
                            name="checkmark-circle"
                            size={13}
                            color={colors.primaryDeep}
                          />
                        )}
                        <Text
                          style={[
                            styles.photoStatus,
                            captured && styles.photoStatusDone,
                          ]}
                        >
                          {captured ? 'Photo captured' : 'Photo required'}
                        </Text>
                      </View>
                    </View>

                    <Pressable
                      onPress={() => takePhoto(index)}
                      disabled={isLocating}
                      style={({ pressed }) => [
                        styles.cameraButton,
                        captured
                          ? styles.cameraButtonRetake
                          : styles.cameraButtonPrimary,
                        pressed && styles.pressed,
                        isLocating && styles.disabled,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`${
                        captured ? 'Retake' : 'Open camera for'
                      } ${item.label}`}
                    >
                      <Ionicons
                        name={captured ? 'refresh' : 'camera'}
                        size={15}
                        color={captured ? colors.primaryDeep : colors.white}
                      />
                      <Text
                        style={[
                          styles.cameraButtonText,
                          captured
                            ? styles.cameraButtonTextRetake
                            : styles.cameraButtonTextPrimary,
                        ]}
                      >
                        {captured ? 'Retake' : 'Open camera'}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}

              <View style={styles.gpsRow}>
                <Ionicons
                  name="navigate-outline"
                  size={13}
                  color={colors.textSecondary}
                />
                <Text style={styles.gpsText}>
                  {isLocating
                    ? 'Getting your location…'
                    : `GPS: ${
                        photos[0]?.latitude != null &&
                        photos[0]?.longitude != null
                          ? `${photos[0].latitude.toFixed(5)}, ${photos[0].longitude.toFixed(5)}${
                              photos[0].accuracy != null
                                ? ` (±${Math.round(photos[0].accuracy)} m)`
                                : ''
                            }`
                          : 'Unavailable in the first photo'
                      }`}
                </Text>
              </View>
            </>
          )}

          {step === 3 && (
            <>
              <Text style={styles.sectionTitle}>Spot details</Text>
              <Text style={styles.requiredNote}>All fields are required.</Text>
              {field('price', 'Price per hour (₹)', price, setPrice, {
                keyboardType: 'decimal-pad',
                placeholder: 'e.g. 40',
                sanitize: sanitizePrice,
                prefix: '₹',
                suffix: '/hr',
                helper: 'Enter 0 if parking is free.',
              })}

              <View style={styles.field}>
                <View style={styles.hoursHeader}>
                  <Text style={styles.label}>Operating hours</Text>

                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>Open 24 hours</Text>
                    <Switch
                      value={isOpen24Hours}
                      onValueChange={(next) => {
                        setIsOpen24Hours(next);
                        clearFieldError('operatingHours');
                      }}
                      trackColor={{
                        // Light: grey track on white; dark: deep track so the white thumb stands out.
                        false: isDark ? colors.borderStrong : colors.textSecondary,
                        true: colors.primary,
                      }}
                      thumbColor={colors.white}
                      accessibilityLabel="Open 24 hours"
                    />
                  </View>
                </View>

                {!isOpen24Hours && (
                  <View style={styles.hoursRow}>
                    <TimeSelect
                      label="Opens at"
                      value={openTime}
                      onChange={(time) => {
                        setOpenTime(time);
                        clearFieldError('operatingHours');
                      }}
                      error={!!fieldErrors.operatingHours}
                    />
                    <TimeSelect
                      label="Closes at"
                      value={closeTime}
                      onChange={(time) => {
                        setCloseTime(time);
                        clearFieldError('operatingHours');
                      }}
                      error={!!fieldErrors.operatingHours}
                    />
                  </View>
                )}

                {fieldErrors.operatingHours ? (
                  <View style={styles.errorRow}>
                    <Ionicons
                      name="alert-circle"
                      size={13}
                      color={colors.errorText}
                    />
                    <Text style={styles.errorText}>
                      {fieldErrors.operatingHours}
                    </Text>
                  </View>
                ) : operatingHours ? (
                  <Text style={styles.helperText}>{operatingHours}</Text>
                ) : null}
              </View>

              {field('capacity', 'Capacity', capacity, setCapacity, {
                keyboardType: 'number-pad',
                placeholder: 'Number of vehicles',
                sanitize: sanitizeCapacity,
                suffix: 'vehicles',
              })}
            </>
          )}
        </View>

        <View style={styles.footer}>
          {step > 1 && (
            <Pressable
              onPress={() => setStep((current) => current - 1)}
              disabled={loading}
              style={({ pressed }) => [
                styles.previousButton,
                pressed && styles.pressed,
                loading && styles.disabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Previous step"
            >
              <Text style={styles.previousText}>Previous step</Text>
            </Pressable>
          )}

          <View style={styles.primaryAction}>
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
          </View>
        </View>

        {loading && (
          <Text style={styles.loadingText}>
            Uploading photos and submitting claim…
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const STEP_CIRCLE = 30;

const createStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingHorizontal: spacing.lg,
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
    pressed: {
      opacity: 0.75,
    },
    disabled: {
      opacity: 0.5,
    },
    eyebrow: {
      color: colors.goldDeep,
      fontSize: typography.overline,
      lineHeight: typography.overlineLineHeight,
      fontWeight: fontWeight.bold,
      letterSpacing: letterSpacing.overline,
      marginBottom: spacing.xs,
    },
    heading: {
      color: colors.text,
      fontSize: typography.title,
      lineHeight: typography.titleLineHeight,
      fontWeight: fontWeight.bold,
      letterSpacing: letterSpacing.tight,
    },
    spotChip: {
      alignSelf: 'flex-start',
      maxWidth: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: spacing.sm,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    spotChipText: {
      flexShrink: 1,
      color: colors.text,
      fontSize: typography.caption + 1,
      fontWeight: fontWeight.medium,
    },

    // Stepper
    stepRow: {
      flexDirection: 'row',
      marginTop: spacing.lg,
      marginBottom: spacing.lg,
    },
    stepItem: {
      flex: 1,
      alignItems: 'center',
      gap: 6,
    },
    stepTrack: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'stretch',
    },
    stepConnector: {
      flex: 1,
      height: 2,
      backgroundColor: colors.border,
    },
    stepConnectorDone: {
      backgroundColor: colors.primary,
    },
    stepConnectorHidden: {
      backgroundColor: 'transparent',
    },
    stepCircle: {
      width: STEP_CIRCLE,
      height: STEP_CIRCLE,
      borderRadius: STEP_CIRCLE / 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepCircleFilled: {
      backgroundColor: colors.primary,
    },
    stepCircleUpcoming: {
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.textSecondary,
    },
    stepNumber: {
      fontSize: 13,
      fontWeight: fontWeight.semibold,
    },
    stepNumberActive: {
      color: colors.white,
    },
    stepNumberUpcoming: {
      color: colors.textSecondary,
    },
    stepLabel: {
      color: colors.textSecondary,
      fontSize: typography.caption,
      textAlign: 'center',
    },
    stepLabelActive: {
      color: colors.primaryDeep,
      fontWeight: fontWeight.semibold,
    },

    // Step card
    card: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: spacing.md + 2,
      marginBottom: spacing.lg,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 18,
      lineHeight: 24,
      fontWeight: fontWeight.bold,
      letterSpacing: letterSpacing.snug,
    },
    requiredNote: {
      color: colors.textSecondary,
      fontSize: typography.caption,
      marginTop: 2,
      marginBottom: spacing.md,
    },
    field: {
      marginBottom: 14,
    },
    label: {
      color: colors.text,
      fontSize: typography.small,
      fontWeight: fontWeight.medium,
      marginBottom: 6,
    },
    inputRow: {
      minHeight: 50,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: colors.textSecondary,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.surface,
    },
    input: {
      flex: 1,
      minWidth: 0,
      paddingVertical: 12,
      color: colors.text,
      fontSize: typography.body,
    },
    inputAffix: {
      color: colors.textSecondary,
      fontSize: typography.small,
      fontWeight: fontWeight.medium,
    },
    inputFocused: {
      borderColor: colors.primary,
      borderWidth: 1.5,
    },
    inputError: {
      borderColor: colors.errorText,
      borderWidth: 1.5,
    },
    errorRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 5,
      marginTop: 6,
    },
    errorText: {
      flex: 1,
      color: colors.errorText,
      fontSize: typography.caption + 0.5,
      lineHeight: 17,
    },
    helperText: {
      color: colors.textSecondary,
      fontSize: typography.caption,
      lineHeight: 17,
      marginTop: 6,
    },
    hoursHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginBottom: 4,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    switchLabel: {
      color: colors.textSecondary,
      fontSize: typography.caption + 1,
      fontWeight: fontWeight.medium,
    },
    hoursRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 4,
    },
    hint: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 4,
      marginBottom: spacing.sm,
    },

    // Photo rows
    photoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    photoRowLast: {
      borderBottomWidth: 0,
    },
    photoIcon: {
      width: 48,
      height: 48,
      borderRadius: radius.md,
      backgroundColor: colors.champagneSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    thumbnail: {
      width: 48,
      height: 48,
      borderRadius: radius.md,
      backgroundColor: colors.skeleton,
    },
    photoText: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    photoLabel: {
      color: colors.text,
      fontSize: 15,
      fontWeight: fontWeight.semibold,
    },
    photoStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    photoStatus: {
      color: colors.textSecondary,
      fontSize: typography.caption + 0.5,
    },
    photoStatusDone: {
      color: colors.primaryDeep,
      fontWeight: fontWeight.medium,
    },
    cameraButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: radius.pill,
    },
    cameraButtonPrimary: {
      backgroundColor: colors.primary,
    },
    cameraButtonRetake: {
      backgroundColor: colors.primarySoft,
    },
    cameraButtonText: {
      fontSize: 13,
      fontWeight: fontWeight.semibold,
    },
    cameraButtonTextPrimary: {
      color: colors.white,
    },
    cameraButtonTextRetake: {
      color: colors.primaryDeep,
    },
    gpsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: spacing.sm,
    },
    gpsText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: typography.caption,
      lineHeight: 17,
    },

    // Footer
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    previousButton: {
      paddingVertical: 14,
      paddingHorizontal: spacing.xs,
    },
    previousText: {
      color: colors.text,
      fontSize: typography.small + 1,
      fontWeight: fontWeight.semibold,
    },
    primaryAction: {
      flex: 1,
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: typography.caption + 1,
      textAlign: 'center',
      marginTop: 12,
    },
  });
