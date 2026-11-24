
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  dismissFeedbackRequest,
  getPendingFeedbackRequests,
  clearFeedbackRequest,
} from '../lib/feedbackStorage';

import {
  getParkingHistory,
  submitParkingRating,
} from '../lib/api';

import { supabase } from '../lib/supabase';
import { useDialog } from '../contexts/DialogContext';
import { useTheme } from '../contexts/ThemeContext';

import { initialWindowMetrics } from 'react-native-safe-area-context';

import {
  colors as lightColors,
  fontWeight,
  radius,
  shadow,
  size,
  spacing,
  typography,
} from '../constants/tokens';

// Sit just above the tab bar, which grows by the bottom safe-area inset.
const BUBBLE_BOTTOM_OFFSET =
  size.tabBarHeight +
  Math.max(initialWindowMetrics?.insets.bottom ?? 0, spacing.sm) +
  12;

type FeedbackItem = {
  sessionId: string;
  spotId: string;
  spotName: string;
};

type Props = {
  hidden?: boolean;
};

export default function FeedbackBubble({ hidden = false }: Props) {
  const { showDialog } = useDialog();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [feedback, setFeedback] = useState<FeedbackItem | null>(null);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [activeStar, setActiveStar] = useState<number | null>(null);

  const isLoading = useRef(false);
  const isMounted = useRef(false);

  const loadFeedback = useCallback(async () => {
    if (isLoading.current) {
      return;
    }

    isLoading.current = true;

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!session?.access_token) {
        if (isMounted.current) {
          setFeedback(null);
        }
        return;
      }

      // Get all pending feedback requests.
      const pendingRequests = await getPendingFeedbackRequests();

      // Only show requests whose reminder delay has passed.
      const dueRequests = pendingRequests.filter(
        (request) => request.reminder_due_at <= Date.now(),
      );

      if (dueRequests.length === 0) {
        if (isMounted.current) {
          setFeedback(null);
        }
        return;
      }

      const pendingSessionIds = dueRequests.map(
        (request) => request.session_id,
      );

      // Fetch completed parking sessions.
      const history = await getParkingHistory(session.access_token);

      const eligibleSessions = history.filter(
        (item) =>
          pendingSessionIds.includes(item.id) &&
          item.checked_out_at !== null,
      );

      if (eligibleSessions.length === 0) {
        if (isMounted.current) {
          setFeedback(null);
        }
        return;
      }

      const eligibleSessionIds = eligibleSessions.map(
        (item) => item.id,
      );

      // Exclude sessions that already have a submitted rating.
      const { data: existingRatings, error: ratingsError } =
        await supabase
          .from('satisfaction_ratings')
          .select('session_id')
          .in('session_id', eligibleSessionIds);

      if (ratingsError) {
        throw ratingsError;
      }

      const ratedSessionIds = new Set(
        (existingRatings ?? []).map((rating) => rating.session_id),
      );

      const unratedSessions = eligibleSessions
        .filter((item) => !ratedSessionIds.has(item.id))
        .sort(
          (a, b) =>
            new Date(b.checked_out_at!).getTime() -
            new Date(a.checked_out_at!).getTime(),
        );

      if (unratedSessions.length === 0) {
        if (isMounted.current) {
          setFeedback(null);
        }
        return;
      }

      const latestSession = unratedSessions[0];

      if (isMounted.current) {
        setFeedback({
          sessionId: latestSession.id,
          spotId: latestSession.spot_id,
          spotName:
            latestSession.parking_spots?.name ?? 'Your parking spot',
        });
      }
    } catch (error) {
      console.error('COULD NOT LOAD PENDING FEEDBACK:', error);
    } finally {
      isLoading.current = false;
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;

    void loadFeedback();

    // Periodically check for newly eligible feedback requests.
    const interval = setInterval(() => {
      void loadFeedback();
    }, 30000);

    // Refresh when the user returns to the app.
    const appStateSubscription = AppState.addEventListener(
      'change',
      (state) => {
        if (state === 'active') {
          void loadFeedback();
        }
      },
    );

    return () => {
      isMounted.current = false;
      clearInterval(interval);
      appStateSubscription.remove();
    };
  }, [loadFeedback]);

  const handleRate = async (rating: number) => {
    if (!feedback || submittingRating) {
      return;
    }

    setSubmittingRating(true);
    setActiveStar(rating);

    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        throw error;
      }

      if (!session?.access_token) {
        throw new Error('Please sign in again to submit your rating.');
      }

      await submitParkingRating(session.access_token, {
        spot_id: feedback.spotId,
        session_id: feedback.sessionId,
        rating,
        comment: null,
      });

      try {
        await clearFeedbackRequest(feedback.sessionId);
      } catch (storageError) {
        console.error(
          'COULD NOT CLEAR RATED FEEDBACK REQUEST:',
          storageError,
        );
      }

      setFeedback(null);
    } catch (error) {
      console.error('QUICK RATING FAILED:', error);

      showDialog({
        type: 'error',
        title: 'Rating failed',
        message:
          error instanceof Error
            ? error.message
            : 'Could not submit your rating. Please try again.',
      });
    } finally {
      setSubmittingRating(false);
      setActiveStar(null);
    }
  };

  const handleDismiss = async () => {
    if (!feedback || submittingRating) {
      return;
    }

    const sessionId = feedback.sessionId;

    setFeedback(null);

    try {
      await dismissFeedbackRequest(sessionId);
    } catch (error) {
      console.error('COULD NOT DISMISS FEEDBACK REQUEST:', error);

      showDialog({
        type: 'error',
        title: 'Could not dismiss',
        message: 'Please try again.',
      });

      void loadFeedback();
    }
  };

  if (hidden || !feedback) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={styles.overlay}
    >
      <View style={styles.bubble}>
        <View style={styles.header}>
          <View style={styles.markCircle}>
            <Ionicons name="star" size={17} color={colors.star} />
          </View>

          <View style={styles.textContainer}>
            <Text style={styles.title}>
              How was your parking?
            </Text>

            <Text
              style={styles.spotName}
              numberOfLines={1}
            >
              {feedback.spotName}
            </Text>
          </View>

          <Pressable
            onPress={handleDismiss}
            disabled={submittingRating}
            hitSlop={10}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.closeButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Dismiss feedback"
          >
            <Ionicons
              name="close"
              size={16}
              color={colors.textSecondary}
            />
          </Pressable>
        </View>

        <View style={styles.ratingRow}>
          <Text style={styles.ratingHint}>
            Tap to rate
          </Text>

          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable
                key={star}
                onPress={() => handleRate(star)}
                disabled={submittingRating}
                style={styles.starButton}
                accessibilityRole="button"
                accessibilityLabel={`${star} star${star > 1 ? 's' : ''}`}
              >
                {submittingRating && activeStar === star ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.star}
                  />
                ) : (
                  <Ionicons
                    name="star"
                    size={24}
                    color={colors.star}
                  />
                )}
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    overlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: BUBBLE_BOTTOM_OFFSET,
      paddingHorizontal: spacing.md,
      zIndex: 1000,
      elevation: 1000,
      alignItems: 'center',
      pointerEvents: 'box-none',
    },
    bubble: {
      width: '100%',
      maxWidth: 480,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.champagne,
      borderRadius: radius.xl,
      paddingHorizontal: 14,
      paddingVertical: 12,
      ...shadow.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    markCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.champagneSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    textContainer: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      color: colors.text,
      fontSize: 15,
      lineHeight: 20,
      fontWeight: fontWeight.semibold,
    },
    spotName: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 17,
      marginTop: 1,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeButtonPressed: {
      opacity: 0.7,
    },
    ratingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    ratingHint: {
      color: colors.textSecondary,
      fontSize: typography.caption + 1,
    },
    starsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    starButton: {
      width: 34,
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
