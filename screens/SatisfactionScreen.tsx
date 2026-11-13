
import { useEffect, useRef, useState } from 'react';
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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';

import type { RootStackParamList } from '../App';
import { getSpotAvailability, submitParkingRating } from '../lib/api';
import {
  clearFeedbackRequest,
  savePendingFeedbackRequest,
  SATISFACTION_REMINDER_DELAY_SECONDS,
} from '../lib/feedbackStorage';
import { supabase } from '../lib/supabase';
import {
  colors,
  fontWeight,
  radius,
  spacing,
  typography,
} from '../constants/tokens';

type Props = NativeStackScreenProps<
  RootStackParamList,
  'Satisfaction'
>;

export default function SatisfactionScreen({
  route,
  navigation,
}: Props) {
  const { spotId, sessionId } = route.params;

  // Identifies whether this screen was opened through a reminder notification.
  const isReminder =
    (route.params as RootStackParamList['Satisfaction'] & {
      isReminder?: boolean;
    }).isReminder === true;

  const [spotName, setSpotName] = useState('Your parking spot');
  const [selectedRating, setSelectedRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isLoadingSpot, setIsLoadingSpot] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Prevent duplicate scheduling and reminders after successful submission.
  const hasScheduledReminder = useRef(false);
  const hasSubmittedRating = useRef(false);

  useEffect(() => {
    let isActive = true;

    const loadSpotName = async () => {
      try {
        const spot = await getSpotAvailability(spotId);

        if (isActive) {
          setSpotName(spot.name);
        }
      } catch (error) {
        console.error('Could not load parking spot name:', error);
      } finally {
        if (isActive) {
          setIsLoadingSpot(false);
        }
      }
    };

    void loadSpotName();

    return () => {
      isActive = false;
    };
  }, [spotId]);

  // Schedule one fallback reminder when the immediate satisfaction
  // screen is dismissed without a successful rating submission.
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      // A reminder notification has already brought the user here.
      // Never schedule another reminder from this screen.
      if (isReminder) {
        return;
      }

      // Do not schedule after a successful rating submission.
      if (hasSubmittedRating.current) {
        return;
      }

      // Prevent duplicate scheduling attempts.
      if (hasScheduledReminder.current) {
        return;
      }

      hasScheduledReminder.current = true;

      const scheduleReminder = async () => {
        // Save the pending request for the floating feedback bubble.
        // This happens even if notification permission is unavailable.
        try {
          const reminderDueAt =
            Date.now() +
            SATISFACTION_REMINDER_DELAY_SECONDS * 1000;

          await savePendingFeedbackRequest(
            sessionId,
            reminderDueAt,
          );
        } catch (storageError) {
          console.error(
            'COULD NOT SAVE PENDING FEEDBACK REQUEST:',
            storageError,
          );
        }

        // Schedule the local notification separately.
        try {
          const permission = await Notifications.getPermissionsAsync();

          if (!permission.granted) {
            console.warn(
              'Notification permission not granted. Reminder not scheduled.',
            );
            return;
          }

          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'How was your parking?',
              body: `Rate your experience at ${spotName}`,
              data: {
                spot_id: spotId,
                session_id: sessionId,
              },
              sound: 'default',
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
              seconds: SATISFACTION_REMINDER_DELAY_SECONDS,
            },
          });
        } catch (notificationError) {
          console.error(
            'NOTIFICATION SCHEDULING FAILED:',
            notificationError,
          );
        }
      };

      void scheduleReminder();
    });

    return unsubscribe;
  }, [navigation, isReminder, spotId, sessionId, spotName]);

  const handleSubmit = async () => {
    if (selectedRating < 1 || selectedRating > 5) {
      Alert.alert(
        'Rating required',
        'Please select a star rating before submitting.',
      );
      return;
    }

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        throw error;
      }

      if (!session?.access_token) {
        Alert.alert(
          'Sign in required',
          'Please sign in again to submit your rating.',
        );
        return;
      }

      await submitParkingRating(session.access_token, {
        spot_id: spotId,
        session_id: sessionId,
        rating: selectedRating,
        comment: comment.trim() || null,
      });

      // Mark as submitted before closing the screen.
      // The beforeRemove listener will now skip notification scheduling.
      hasSubmittedRating.current = true;

      // Remove the pending floating bubble request.
      // If this fails, the bubble's server-side rating check will
      // still prevent this session from appearing again.
      try {
        await clearFeedbackRequest(sessionId);
      } catch (storageError) {
        console.error(
          'COULD NOT CLEAR PENDING FEEDBACK REQUEST:',
          storageError,
        );
      }

      Alert.alert(
        'Thank you!',
        'Your parking experience has been rated.',
        [
          {
            text: 'Done',
            onPress: () => navigation.goBack(),
          },
        ],
        { cancelable: false },
      );
    } catch (error) {
      console.error('Could not submit parking rating:', error);

      Alert.alert(
        'Rating failed',
        error instanceof Error
          ? error.message
          : 'Could not submit your rating. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>PARKCITY</Text>

          <Pressable
            onPress={handleSkip}
            style={styles.skipButton}
            disabled={isSubmitting}
          >
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.illustration}>★</Text>

          <Text style={styles.title}>
            How was your parking?
          </Text>

          <Text style={styles.subtitle}>
            Your feedback helps others find better parking spots.
          </Text>

          <View style={styles.spotContainer}>
            {isLoadingSpot ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={styles.spotName}>{spotName}</Text>
            )}
          </View>

          <Text style={styles.ratingLabel}>
            Rate your experience
          </Text>

          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable
                key={star}
                onPress={() => setSelectedRating(star)}
                disabled={isSubmitting}
                style={styles.starButton}
                accessibilityRole="button"
                accessibilityLabel={`${star} star${star > 1 ? 's' : ''}`}
                accessibilityState={{
                  selected: selectedRating === star,
                }}
              >
                <Text
                  style={[
                    styles.star,
                    star <= selectedRating && styles.selectedStar,
                  ]}
                >
                  ★
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.ratingDescription}>
            {selectedRating === 0
              ? 'Tap a star to rate'
              : selectedRating === 1
                ? 'Poor'
                : selectedRating === 2
                  ? 'Below average'
                  : selectedRating === 3
                    ? 'Average'
                    : selectedRating === 4
                      ? 'Good'
                      : 'Excellent'}
          </Text>

          <Text style={styles.commentLabel}>
            Anything you'd like to add? (Optional)
          </Text>

          <TextInput
            style={styles.commentInput}
            placeholder="Share your experience..."
            placeholderTextColor={colors.textSecondary}
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            editable={!isSubmitting}
            maxLength={500}
          />

          <Text style={styles.characterCount}>
            {comment.length}/500
          </Text>

          <Pressable
            style={[
              styles.submitButton,
              (isSubmitting || selectedRating === 0) &&
                styles.disabledButton,
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting || selectedRating === 0}
            accessibilityRole="button"
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.submitButtonText}>
                Submit Rating
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    paddingTop: spacing.xl * 2,
    paddingBottom: spacing.xl * 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  eyebrow: {
    color: colors.textSecondary,
    fontSize: typography.small,
    fontWeight: fontWeight.bold,
    letterSpacing: 2,
  },
  skipButton: {
    padding: spacing.sm,
  },
  skipText: {
    color: colors.textSecondary,
    fontSize: typography.body,
    fontWeight: fontWeight.medium,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  illustration: {
    fontSize: 48,
    color: colors.primary,
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: typography.body,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  spotContainer: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  spotName: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
  },
  ratingLabel: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: fontWeight.semibold,
    marginTop: spacing.xl,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  starButton: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  star: {
    fontSize: 38,
    color: colors.border,
  },
  selectedStar: {
    color: '#F5B82E',
  },
  ratingDescription: {
    color: colors.textSecondary,
    fontSize: typography.small,
    marginTop: spacing.sm,
    minHeight: 20,
  },
  commentLabel: {
    alignSelf: 'flex-start',
    color: colors.text,
    fontSize: typography.small,
    fontWeight: fontWeight.semibold,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  commentInput: {
    width: '100%',
    minHeight: 110,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: typography.body,
    backgroundColor: colors.background,
  },
  characterCount: {
    alignSelf: 'flex-end',
    color: colors.textSecondary,
    fontSize: typography.small,
    marginTop: spacing.xs,
  },
  submitButton: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
    minHeight: 50,
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: colors.background,
    fontSize: typography.body,
    fontWeight: fontWeight.semibold,
  },
  secondarySkipButton: {
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  secondarySkipText: {
    color: colors.textSecondary,
    fontSize: typography.small,
    fontWeight: fontWeight.medium,
  },
});
