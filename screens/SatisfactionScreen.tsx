
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { useDialog } from '../contexts/DialogContext';
import { useTheme } from '../contexts/ThemeContext';
import PrimaryButton from '../components/ui/PrimaryButton';
import { useKeyboardAwareScroll } from '../hooks/useKeyboardAwareScroll';
import {
  colors as lightColors,
  fontWeight,
  letterSpacing,
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
  const { showDialog } = useDialog();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardAwareScroll();

  // Display-only focus state for the comment input border.
  const [isCommentFocused, setIsCommentFocused] = useState(false);

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
      showDialog({
        type: 'warning',
        title: 'Rating required',
        message: 'Please select a star rating before submitting.',
      });
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
        showDialog({
          type: 'warning',
          title: 'Sign in required',
          message: 'Please sign in again to submit your rating.',
        });
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

      showDialog({
        type: 'success',
        title: 'Thank you!',
        message: 'Your parking experience has been rated.',
        actions: [
          {
            label: 'Done',
            onPress: () => navigation.goBack(),
          },
        ],
        dismissible: false,
      });
    } catch (error) {
      console.error('Could not submit parking rating:', error);

      showDialog({
        type: 'error',
        title: 'Rating failed',
        message:
          error instanceof Error
            ? error.message
            : 'Could not submit your rating. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    navigation.goBack();
  };

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
              spacing.md +
              keyboard.keyboardHeight,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>PARKCITY</Text>

          <Pressable
            onPress={handleSkip}
            style={styles.skipButton}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel="Skip"
            hitSlop={8}
          >
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        </View>

        <View style={styles.body}>
          <View style={styles.mark}>
            <Ionicons name="star" size={32} color={colors.star} />
          </View>

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
              <View style={styles.spotChip}>
                <Ionicons
                  name="location-outline"
                  size={14}
                  color={colors.textSecondary}
                />
                <Text style={styles.spotName} numberOfLines={1}>
                  {spotName}
                </Text>
              </View>
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
                <Ionicons
                  name={star <= selectedRating ? 'star' : 'star-outline'}
                  size={38}
                  color={
                    star <= selectedRating
                      ? colors.star
                      : colors.textSecondary
                  }
                />
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

          <View style={styles.commentLabelRow}>
            <Text style={styles.commentLabel}>
              Anything you'd like to add?
            </Text>
            <Text style={styles.optionalLabel}>(Optional)</Text>
          </View>

          <TextInput
            style={[
              styles.commentInput,
              isCommentFocused && styles.commentInputFocused,
            ]}
            placeholder="Share your experience..."
            placeholderTextColor={colors.textSecondary}
            value={comment}
            onChangeText={setComment}
            onFocus={() => {
              setIsCommentFocused(true);
              keyboard.revealOnFocus();
            }}
            onBlur={() => setIsCommentFocused(false)}
            // Keep the growing comment box above the keyboard as lines are added.
            onContentSizeChange={keyboard.revealOnFocus}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            editable={!isSubmitting}
            maxLength={500}
            accessibilityLabel="Comment, optional"
          />

          <Text style={styles.characterCount}>
            {comment.length}/500
          </Text>

          <PrimaryButton
            title="Submit Rating"
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting || selectedRating === 0}
            style={styles.submitButton}
          />
        </View>
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
      flexGrow: 1,
      paddingHorizontal: spacing.lg,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    eyebrow: {
      color: colors.goldDeep,
      fontSize: typography.overline,
      lineHeight: typography.overlineLineHeight,
      fontWeight: fontWeight.bold,
      letterSpacing: letterSpacing.overline,
    },
    skipButton: {
      paddingVertical: spacing.sm,
      paddingLeft: spacing.md,
    },
    skipText: {
      color: colors.textSecondary,
      fontSize: typography.small,
      fontWeight: fontWeight.semibold,
    },
    body: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    mark: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.champagneSoft,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.champagne,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    title: {
      color: colors.text,
      fontSize: typography.title,
      lineHeight: typography.titleLineHeight,
      fontWeight: fontWeight.bold,
      letterSpacing: letterSpacing.tight,
      textAlign: 'center',
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: typography.small + 1,
      lineHeight: 22,
      textAlign: 'center',
      marginTop: spacing.sm,
      maxWidth: 320,
    },
    spotContainer: {
      minHeight: 40,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: spacing.md,
    },
    spotChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      maxWidth: 300,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    spotName: {
      flexShrink: 1,
      color: colors.text,
      fontSize: typography.small,
      fontWeight: fontWeight.semibold,
    },
    ratingLabel: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: fontWeight.semibold,
      marginTop: spacing.lg,
    },
    starsContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: spacing.sm,
    },
    starButton: {
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ratingDescription: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginTop: spacing.xs,
      minHeight: 20,
    },
    commentLabelRow: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 6,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    commentLabel: {
      color: colors.text,
      fontSize: typography.small,
      fontWeight: fontWeight.semibold,
    },
    optionalLabel: {
      color: colors.textSecondary,
      fontSize: typography.caption,
    },
    commentInput: {
      alignSelf: 'stretch',
      minHeight: 104,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: radius.lg,
      padding: spacing.md,
      color: colors.text,
      fontSize: typography.body - 1,
      lineHeight: 21,
      backgroundColor: colors.surface,
    },
    commentInputFocused: {
      borderColor: colors.primary,
    },
    characterCount: {
      alignSelf: 'flex-end',
      color: colors.textSecondary,
      fontSize: typography.caption,
      marginTop: spacing.xs,
    },
    submitButton: {
      alignSelf: 'stretch',
      marginTop: spacing.md,
    },
  });
