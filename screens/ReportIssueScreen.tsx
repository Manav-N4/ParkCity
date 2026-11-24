
import { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../App';
import { useTheme } from '../contexts/ThemeContext';
import { useDialog } from '../contexts/DialogContext';
import PrimaryButton from '../components/ui/PrimaryButton';
import OptionCard from '../components/ui/OptionCard';
import {
  isValidPrice,
  normalizePrice,
  sanitizePrice,
} from '../lib/formValidation';
import { useKeyboardAwareScroll } from '../hooks/useKeyboardAwareScroll';
import { supabase } from '../lib/supabase';
import {
  submitReport,
  type ReportIssueType,
} from '../lib/api';
import {
  colors as lightColors,
  fontWeight,
  letterSpacing,
  radius,
  shadow,
  spacing,
  typography,
} from '../constants/tokens';

type Props = NativeStackScreenProps<
  RootStackParamList,
  'ReportIssue'
>;

type ReportPhoto = {
  uri: string;
  mimeType: string | null;
};

type IoniconName = keyof typeof Ionicons.glyphMap;

const ISSUE_TYPES: {
  value: ReportIssueType;
  label: string;
  description: string;
}[] = [
  {
    value: 'wrong_price',
    label: 'Incorrect pricing',
    description: 'The listed hourly parking price is incorrect.',
  },
  {
    value: 'permanently_closed',
    label: 'Permanently closed',
    description: 'This parking location is no longer operational.',
  },
  {
    value: 'wrong_location',
    label: 'Incorrect location',
    description: 'The parking spot is shown in the wrong place.',
  },
  {
    value: 'unsafe',
    label: 'Unsafe parking spot',
    description: 'There is a safety concern with this location.',
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Report another problem with this parking spot.',
  },
];

// Display-only icons for each existing issue type.
const ISSUE_ICONS: Record<ReportIssueType, IoniconName> = {
  wrong_price: 'pricetag-outline',
  permanently_closed: 'close-circle-outline',
  wrong_location: 'location-outline',
  unsafe: 'warning-outline',
  other: 'ellipsis-horizontal-circle-outline',
};

export default function ReportIssueScreen({
  route,
  navigation,
}: Props) {
  const { spot } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardAwareScroll();
  const { showDialog } = useDialog();

  // Display-only focus state for the price input border.
  const [isPriceFocused, setIsPriceFocused] = useState(false);

  const [issueType, setIssueType] = useState<ReportIssueType | null>(null);
  const [reportedPrice, setReportedPrice] = useState('');
  const [photo, setPhoto] = useState<ReportPhoto | null>(null);
  const [loading, setLoading] = useState(false);

  const selectPhoto = async (source: 'camera' | 'gallery') => {
    try {
      let result: ImagePicker.ImagePickerResult;

      if (source === 'camera') {
        const permission =
          await ImagePicker.requestCameraPermissionsAsync();

        if (!permission.granted) {
          showDialog({
            type: 'warning',
            title: 'Camera permission required',
            message: 'Allow camera access in your device settings to take a photo.',
          });
          return;
        }

        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          cameraType: ImagePicker.CameraType.back,
          allowsEditing: true,
          quality: 0.8,
        });
      } else {
        const permission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permission.granted) {
          showDialog({
            type: 'warning',
            title: 'Gallery permission required',
            message: 'Allow photo library access to select an image.',
          });
          return;
        }

        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          quality: 0.8,
        });
      }

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];

      setPhoto({
        uri: asset.uri,
        mimeType: asset.mimeType ?? null,
      });
    } catch (error) {
      showDialog({
        type: 'error',
        title: 'Photo error',
        message: error instanceof Error
          ? error.message
          : 'Could not select this photo.',
      });
    }
  };

  const uploadPhoto = async (
    selectedPhoto: ReportPhoto,
    userId: string
  ): Promise<string> => {
    const response = await fetch(selectedPhoto.uri);

    if (!response.ok) {
      throw new Error('Could not read the selected photo.');
    }

    const fileData = await response.arrayBuffer();

    const mimeType = selectedPhoto.mimeType || 'image/jpeg';

    const extension =
      mimeType === 'image/png'
        ? 'png'
        : mimeType === 'image/webp'
          ? 'webp'
          : 'jpg';

    const path =
      `${userId}/${spot.id}/reports/${Date.now()}.${extension}`;

    const { error } = await supabase.storage
      .from('claim-photos')
      .upload(path, fileData, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      throw new Error(`Photo upload failed: ${error.message}`);
    }

    return path;
  };

  const handleSubmit = async () => {
    if (!issueType) {
      showDialog({
        type: 'warning',
        title: 'Select an issue',
        message: 'Please select the problem you want to report.',
      });
      return;
    }

    if (!spot.id) {
      showDialog({
        type: 'error',
        title: 'Invalid parking spot',
        message: 'The parking spot ID is missing. Please go back and try again.',
      });
      return;
    }

    if (issueType === 'wrong_price') {
      // Same rule as Claim Spot: 0–9999, at most 2 decimals, no trailing ".".
      if (!isValidPrice(reportedPrice)) {
        showDialog({
          type: 'warning',
          title: 'Invalid price',
          message:
            'Enter the correct hourly parking price, between ₹0 and ₹9999 (up to 2 decimals).',
        });
        return;
      }
    }

    setLoading(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!session?.user || !session.access_token) {
        showDialog({
          type: 'warning',
          title: 'Sign in required',
          message: 'Please sign in before submitting a report.',
        });
        return;
      }

      let photoPath: string | undefined;

      if (photo) {
        photoPath = await uploadPhoto(photo, session.user.id);
      }

      await submitReport(session.access_token, {
        spot_id: spot.id,
        issue_type: issueType,
        field_name:
          issueType === 'wrong_price' ? 'price_per_hour' : null,
        reported_value:
          issueType === 'wrong_price'
            ? normalizePrice(reportedPrice)
            : null,
        ...(photoPath ? { photo_url: photoPath } : {}),
      });

      showDialog({
        type: 'success',
        title: 'Report submitted',
        message: 'Thank you for helping us keep ParkCity accurate.',
        actions: [
          {
            label: 'Done',
            variant: 'primary',
            onPress: () => navigation.goBack(),
          },
        ],
      });
    } catch (error) {
      showDialog({
        type: 'error',
        title: 'Could not submit report',
        message: error instanceof Error
          ? error.message
          : 'Something went wrong. Please try again.',
      });
    } finally {
      setLoading(false);
    }
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
          disabled={loading}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
            loading && styles.disabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Back to parking"
          hitSlop={6}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </Pressable>

        <Text style={styles.eyebrow}>REPORT</Text>

        <Text style={styles.heading}>Report an Issue</Text>

        <Text style={styles.subtitle}>
          Help us keep parking information accurate.
        </Text>

        <View style={styles.spotCard}>
          <View style={styles.spotIcon}>
            <Ionicons name="car-outline" size={18} color={colors.goldDeep} />
          </View>

          <View style={styles.spotText}>
            <Text style={styles.spotLabel}>PARKING SPOT</Text>

            <Text style={styles.spotName} numberOfLines={2}>
              {spot.name}
            </Text>

            {hasAddress && (
              <Text style={styles.spotAddress} numberOfLines={1}>
                {spot.address}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>What is the issue?</Text>
          <Text style={styles.requiredTag}>Required</Text>
        </View>

        <View style={styles.issueList}>
          {ISSUE_TYPES.map((item) => (
            <OptionCard
              key={item.value}
              icon={ISSUE_ICONS[item.value]}
              title={item.label}
              description={item.description}
              selected={issueType === item.value}
              disabled={loading}
              onPress={() => setIssueType(item.value)}
              accessibilityLabel={`${item.label}. ${item.description}`}
            />
          ))}
        </View>

        {issueType === 'wrong_price' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                What is the correct price?
              </Text>
              <Text style={styles.requiredTag}>Required</Text>
            </View>

            <View
              style={[
                styles.priceInputRow,
                isPriceFocused && styles.inputFocused,
              ]}
            >
              <Text style={styles.currencySymbol}>₹</Text>

              <TextInput
                value={reportedPrice}
                onChangeText={(text) => setReportedPrice(sanitizePrice(text))}
                placeholder="Enter price per hour"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
                editable={!loading}
                onFocus={() => {
                  setIsPriceFocused(true);
                  keyboard.revealOnFocus();
                }}
                onBlur={() => setIsPriceFocused(false)}
                style={styles.priceInput}
                accessibilityLabel="Correct price per hour, in rupees"
              />

              <Text style={styles.priceSuffix}>/hr</Text>
            </View>

            <Text style={styles.helperText}>
              Enter the correct parking price per hour.
            </Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Add a photo
            <Text style={styles.optionalText}>
              {' '}(Optional)
            </Text>
          </Text>

          <Text style={styles.helperText}>
            A photo can help us verify the reported issue.
          </Text>

          {photo ? (
            <View style={styles.previewContainer}>
              <Image
                source={{ uri: photo.uri }}
                style={styles.previewImage}
              />

              <Pressable
                onPress={() => setPhoto(null)}
                disabled={loading}
                style={({ pressed }) => [
                  styles.removePhotoButton,
                  pressed && styles.pressed,
                  loading && styles.disabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Remove photo"
              >
                <Ionicons
                  name="trash-outline"
                  size={15}
                  color={colors.errorText}
                />
                <Text style={styles.removePhotoText}>
                  Remove photo
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.photoActions}>
              <Pressable
                onPress={() => selectPhoto('camera')}
                disabled={loading}
                style={({ pressed }) => [
                  styles.photoTile,
                  pressed && styles.photoTilePressed,
                  loading && styles.disabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Take a photo"
              >
                <View style={styles.photoTileIcon}>
                  <Ionicons
                    name="camera-outline"
                    size={20}
                    color={colors.primaryDeep}
                  />
                </View>
                <Text style={styles.photoTileText}>Take a photo</Text>
              </Pressable>

              <Pressable
                onPress={() => selectPhoto('gallery')}
                disabled={loading}
                style={({ pressed }) => [
                  styles.photoTile,
                  pressed && styles.photoTilePressed,
                  loading && styles.disabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Choose from gallery"
              >
                <View style={styles.photoTileIcon}>
                  <Ionicons
                    name="images-outline"
                    size={20}
                    color={colors.primaryDeep}
                  />
                </View>
                <Text style={styles.photoTileText}>
                  Choose from gallery
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.submitContainer}>
          <PrimaryButton
            title="Submit report"
            loading={loading}
            disabled={loading}
            onPress={handleSubmit}
          />
        </View>

        {loading && (
          <Text style={styles.loadingText}>
            Submitting your report...
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

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

    subtitle: {
      color: colors.textSecondary,
      fontSize: typography.small,
      lineHeight: 21,
      marginTop: spacing.xs,
    },

    // Spot card
    spotCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      marginTop: spacing.lg,
      marginBottom: spacing.lg,
      borderRadius: radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },

    spotIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.champagneSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },

    spotText: {
      flex: 1,
      minWidth: 0,
    },

    spotLabel: {
      color: colors.textSecondary,
      fontSize: typography.overline,
      lineHeight: typography.overlineLineHeight,
      fontWeight: fontWeight.semibold,
      letterSpacing: letterSpacing.overline,
      marginBottom: 3,
    },

    spotName: {
      color: colors.text,
      fontSize: 16,
      lineHeight: 21,
      fontWeight: fontWeight.bold,
    },

    spotAddress: {
      color: colors.textSecondary,
      fontSize: typography.caption + 1,
      lineHeight: 18,
      marginTop: 2,
    },

    // Sections
    section: {
      marginTop: spacing.lg,
    },

    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginBottom: 12,
    },

    sectionTitle: {
      flexShrink: 1,
      color: colors.text,
      fontSize: 16,
      lineHeight: 22,
      fontWeight: fontWeight.bold,
    },

    requiredTag: {
      color: colors.goldDeep,
      fontSize: typography.caption,
      fontWeight: fontWeight.semibold,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radius.pill,
      backgroundColor: colors.champagneSoft,
      overflow: 'hidden',
    },

    optionalText: {
      color: colors.textSecondary,
      fontSize: typography.small,
      fontWeight: fontWeight.regular,
    },

    issueList: {
      gap: 10,
    },

    // Price input
    priceInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: 52,
      paddingHorizontal: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.textSecondary,
      backgroundColor: colors.surface,
    },

    inputFocused: {
      borderColor: colors.primary,
      borderWidth: 1.5,
    },

    currencySymbol: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: fontWeight.semibold,
    },

    priceInput: {
      flex: 1,
      paddingVertical: 12,
      color: colors.text,
      fontSize: typography.body,
    },

    priceSuffix: {
      color: colors.textSecondary,
      fontSize: typography.small,
      fontWeight: fontWeight.medium,
    },

    helperText: {
      color: colors.textSecondary,
      fontSize: typography.caption + 0.5,
      lineHeight: 18,
      marginTop: spacing.xs,
    },

    // Photo
    photoActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 12,
    },

    photoTile: {
      flex: 1,
      minWidth: 130,
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
    },

    photoTilePressed: {
      backgroundColor: colors.surfaceMuted,
    },

    photoTileIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },

    photoTileText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: fontWeight.semibold,
      textAlign: 'center',
    },

    previewContainer: {
      marginTop: 12,
      gap: 10,
    },

    previewImage: {
      width: '100%',
      height: 190,
      borderRadius: radius.lg,
      backgroundColor: colors.skeleton,
    },

    removePhotoButton: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.errorText,
      backgroundColor: colors.surface,
    },

    removePhotoText: {
      color: colors.errorText,
      fontSize: 13,
      fontWeight: fontWeight.semibold,
    },

    submitContainer: {
      marginTop: spacing.xl,
    },

    loadingText: {
      color: colors.textSecondary,
      fontSize: typography.caption + 1,
      textAlign: 'center',
      marginTop: 12,
    },
  });
