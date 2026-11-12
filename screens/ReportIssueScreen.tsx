import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import {
  submitReport,
  type ReportIssueType,
} from '../lib/api';
import {
  fontWeight,
  radius,
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

export default function ReportIssueScreen({
  route,
  navigation,
}: Props) {
  const { spot } = route.params;
  const { colors } = useTheme();

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
          Alert.alert(
            'Camera permission required',
            'Allow camera access in your device settings to take a photo.'
          );
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
          Alert.alert(
            'Gallery permission required',
            'Allow photo library access to select an image.'
          );
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
      Alert.alert(
        'Photo error',
        error instanceof Error
          ? error.message
          : 'Could not select this photo.'
      );
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
      Alert.alert(
        'Select an issue',
        'Please select the problem you want to report.'
      );
      return;
    }

    if (!spot.id) {
      Alert.alert(
        'Invalid parking spot',
        'The parking spot ID is missing. Please go back and try again.'
      );
      return;
    }

    if (issueType === 'wrong_price') {
      if (
        reportedPrice.trim() === '' ||
        !Number.isFinite(Number(reportedPrice)) ||
        Number(reportedPrice) < 0
      ) {
        Alert.alert(
          'Invalid price',
          'Enter the correct hourly parking price.'
        );
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
        Alert.alert(
          'Sign in required',
          'Please sign in before submitting a report.'
        );
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
            ? reportedPrice.trim()
            : null,
        ...(photoPath ? { photo_url: photoPath } : {}),
      });

      Alert.alert(
        'Report submitted',
        'Thank you for helping us keep ParkCity accurate.',
        [
          {
            text: 'Done',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      Alert.alert(
        'Could not submit report',
        error instanceof Error
          ? error.message
          : 'Something went wrong. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[
        styles.container,
        { backgroundColor: colors.background },
      ]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => navigation.goBack()}
          disabled={loading}
          style={styles.backButton}
        >
          <Text style={[styles.backText, { color: colors.text }]}>
            ← Back to parking
          </Text>
        </Pressable>

        <Text style={[styles.heading, { color: colors.text }]}>
          Report an Issue
        </Text>

        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Help us keep parking information accurate.
        </Text>

        <View
          style={[
            styles.spotCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.spotLabel, { color: colors.textSecondary }]}>
            PARKING SPOT
          </Text>

          <Text style={[styles.spotName, { color: colors.text }]}>
            {spot.name}
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          What is the issue?
        </Text>

        <View style={styles.issueList}>
          {ISSUE_TYPES.map((item) => {
            const selected = issueType === item.value;

            return (
              <Pressable
                key={item.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                disabled={loading}
                onPress={() => setIssueType(item.value)}
                style={[
                  styles.issueOption,
                  {
                    backgroundColor: colors.surface,
                    borderColor: selected
                      ? colors.primary
                      : colors.border,
                    borderWidth: selected ? 2 : 1,
                  },
                ]}
              >
                <View style={styles.issueOptionContent}>
                  <Text
                    style={[
                      styles.issueLabel,
                      { color: colors.text },
                    ]}
                  >
                    {item.label}
                  </Text>

                  <Text
                    style={[
                      styles.issueDescription,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {item.description}
                  </Text>
                </View>

                <View
                  style={[
                    styles.radioOuter,
                    {
                      borderColor: selected
                        ? colors.primary
                        : colors.textSecondary,
                    },
                  ]}
                >
                  {selected && (
                    <View
                      style={[
                        styles.radioInner,
                        { backgroundColor: colors.primary },
                      ]}
                    />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>

        {issueType === 'wrong_price' && (
          <View style={styles.priceSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              What is the correct price?
            </Text>

            <View style={styles.priceInputWrapper}>
              <Text style={[styles.currencySymbol, { color: colors.text }]}>
                ₹
              </Text>

              <TextInput
                value={reportedPrice}
                onChangeText={setReportedPrice}
                placeholder="Enter price per hour"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
                editable={!loading}
                style={[
                  styles.priceInput,
                  {
                    backgroundColor: colors.surface,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
              />
            </View>

            <Text style={[styles.helperText, { color: colors.textSecondary }]}>
              Enter the correct parking price per hour.
            </Text>
          </View>
        )}

        <View style={styles.photoSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Add a photo
            <Text style={[styles.optionalText, { color: colors.textSecondary }]}>
              {' '}(Optional)
            </Text>
          </Text>

          <Text style={[styles.helperText, { color: colors.textSecondary }]}>
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
                style={[
                  styles.removePhotoButton,
                  { backgroundColor: colors.error },
                ]}
              >
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
                style={[
                  styles.photoButton,
                  {
                    borderColor: colors.primary,
                    backgroundColor: colors.surface,
                  },
                ]}
              >
                <Text style={[styles.photoButtonText, { color: colors.primary }]}>
                  Take a photo
                </Text>
              </Pressable>

              <Pressable
                onPress={() => selectPhoto('gallery')}
                disabled={loading}
                style={[
                  styles.photoButton,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                  },
                ]}
              >
                <Text style={[styles.photoButtonText, { color: colors.text }]}>
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
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Submitting your report...
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
    lineHeight: typography.bodyLineHeight,
  },

  spotCard: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },

  spotLabel: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },

  spotName: {
    fontSize: typography.body,
    fontWeight: fontWeight.semibold,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.md,
  },

  issueList: {
    gap: spacing.sm,
  },

  issueOption: {
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },

  issueOptionContent: {
    flex: 1,
  },

  issueLabel: {
    fontSize: typography.body,
    fontWeight: fontWeight.semibold,
  },

  issueDescription: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.xs,
  },

  radioOuter: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 6,
  },

  priceSection: {
    marginTop: spacing.xl,
  },

  priceInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  currencySymbol: {
    position: 'absolute',
    left: spacing.md,
    zIndex: 1,
    fontSize: typography.body,
    fontWeight: fontWeight.semibold,
  },

  priceInput: {
    flex: 1,
    minHeight: 50,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingLeft: spacing.xl * 1.5,
    paddingRight: spacing.md,
    fontSize: typography.body,
  },

  helperText: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.xs,
  },

  optionalText: {
    fontSize: typography.small,
    fontWeight: fontWeight.regular,
  },

  photoSection: {
    marginTop: spacing.xl,
  },

  photoActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },

  photoButton: {
    flex: 1,
    minWidth: 130,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },

  photoButtonText: {
    fontSize: 13,
    fontWeight: fontWeight.semibold,
  },

  previewContainer: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },

  previewImage: {
    width: '100%',
    height: 190,
    borderRadius: radius.md,
  },

  removePhotoButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },

  removePhotoText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: fontWeight.semibold,
  },

  submitContainer: {
    marginTop: spacing.xl,
  },

  loadingRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },

  loadingText: {
    fontSize: 13,
  },
});