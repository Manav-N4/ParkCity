
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  type DimensionValue,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { MainTabParamList } from '../navigation/MainTabNavigator';
import type { RootStackParamList } from '../App';

import {
  getParkingHistory,
  getSpendSummary,
  type ParkingHistoryItem,
  type SpendSummary,
} from '../lib/api';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import {
  colors as lightColors,
  fontWeight,
  letterSpacing,
  radius,
  spacing,
  typography,
} from '../constants/tokens';
import EmptyState from '../components/ui/EmptyState';
import PrimaryButton from '../components/ui/PrimaryButton';

type Props = BottomTabNavigationProp<MainTabParamList>;

type HistoryStyles = ReturnType<typeof createStyles>;

// Loading placeholder shaped like the real screen (spend card, summary
// tiles, session rows) so nothing jumps when the history arrives.
function HistorySkeleton({
  styles,
  skeletonColor,
}: {
  styles: HistoryStyles;
  skeletonColor: string;
}) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    let cancelled = false;

    void AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduceMotion) => {
        if (cancelled || reduceMotion) return;

        animation = Animated.loop(
          Animated.sequence([
            Animated.timing(pulse, {
              toValue: 1,
              duration: 850,
              useNativeDriver: true,
            }),
            Animated.timing(pulse, {
              toValue: 0,
              duration: 850,
              useNativeDriver: true,
            }),
          ])
        );
        animation.start();
      });

    return () => {
      cancelled = true;
      animation?.stop();
    };
  }, [pulse]);

  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

  const bone = (
    width: DimensionValue,
    height: number,
    extra?: object
  ) => (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: Math.min(height / 2, 6),
          backgroundColor: skeletonColor,
          opacity,
        },
        extra,
      ]}
    />
  );

  return (
    <View
      style={styles.list}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Loading parking history"
    >
      {/* This month */}
      <View style={styles.spendCard}>
        <View style={styles.spendTop}>
          <View style={[styles.spendMain, { gap: 8 }]}>
            {bone(84, 10)}
            {bone(132, 26, { borderRadius: 8 })}
            {bone(150, 12)}
          </View>
          {bone(36, 36, { borderRadius: 18 })}
        </View>
      </View>

      {/* Summary tiles */}
      <View style={styles.summaryRow}>
        {[0, 1].map((tile) => (
          <View key={tile} style={[styles.summaryCard, { gap: 8 }]}>
            {bone('60%', 11)}
            {bone('45%', 20, { borderRadius: 6 })}
          </View>
        ))}
      </View>

      {/* Recent activity */}
      {bone(130, 18, { marginTop: spacing.sm })}
      {bone(70, 10, { marginTop: spacing.md + 4, marginBottom: spacing.sm + 2 })}

      {[0.72, 0.58, 0.66, 0.5].map((nameWidth, index) => (
        <View key={index} style={styles.sessionCard}>
          {bone(38, 38, { borderRadius: 19 })}

          <View style={[styles.sessionInfo, { gap: 8, paddingTop: 2 }]}>
            {bone(`${Math.round(nameWidth * 100)}%`, 14)}
            {bone('82%', 11)}
            {bone('48%', 11)}
          </View>

          <View style={[styles.sessionRight, { gap: 10, paddingTop: 2 }]}>
            {bone(48, 15)}
            {bone(66, 20, { borderRadius: 10 })}
          </View>
        </View>
      ))}
    </View>
  );
}

function formatDate(dateString: string) {
  const date = new Date(dateString);

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDuration(minutes: number | null, checkedInAt: string) {
  const duration =
    minutes ??
    Math.max(
      0,
      Math.floor((Date.now() - new Date(checkedInAt).getTime()) / 60000),
    );

  const hours = Math.floor(duration / 60);
  const remainingMinutes = duration % 60;

  if (hours === 0) return `${remainingMinutes} min`;

  return `${hours}h ${remainingMinutes}m`;
}

// Display-only month heading, e.g. "NOVEMBER 2026".
function formatMonthHeading(dateString: string) {
  return new Date(dateString)
    .toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    .toUpperCase();
}

export default function ParkingHistoryScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const navigation = useNavigation<Props>();
  const [history, setHistory] = useState<ParkingHistoryItem[]>([]);
  const [spendSummary, setSpendSummary] = useState<SpendSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (!session?.access_token) {
        setIsSignedIn(false);
        setHistory([]);
        setSpendSummary(null);
        return;
      }

      setIsSignedIn(true);

      const result = await getParkingHistory(session.access_token);
      setHistory(result);

      try {
        const spendResult = await getSpendSummary(session.access_token);
        setSpendSummary(spendResult);
      } catch (spendError) {
        console.warn('Unable to load spend summary:', spendError);
        setSpendSummary(null);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load your parking history.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [loadHistory]),
  );

  const totalSpent = history.reduce(
    (total, item) => total + (item.estimated_cost ?? 0),
    0,
  );

  const activeSessions = history.filter(
    (item) => item.checked_out_at === null,
  ).length;

  const openSignIn = () => {
    navigation
      .getParent<NativeStackNavigationProp<RootStackParamList>>()
      ?.navigate('EmailLogin', {});
  };

  const renderSession = (item: ParkingHistoryItem) => {
    const isActive = item.checked_out_at === null;

    const timeRange = item.checked_out_at
      ? `${formatTime(item.checked_in_at)} – ${formatTime(item.checked_out_at)}`
      : `Checked in ${formatTime(item.checked_in_at)}`;

    const costText =
      item.estimated_cost == null
        ? isActive
          ? 'Ongoing'
          : 'Unavailable'
        : `₹${item.estimated_cost.toFixed(2)}`;

    return (
      <View key={item.id} style={styles.sessionCard}>
        <View
          style={[
            styles.sessionIcon,
            isActive ? styles.sessionIconActive : styles.sessionIconDone,
          ]}
        >
          <Ionicons
            name={isActive ? 'car' : 'car-outline'}
            size={18}
            color={isActive ? colors.primaryDeep : colors.textSecondary}
          />
        </View>

        <View style={styles.sessionInfo}>
          <Text style={styles.spotName} numberOfLines={2}>
            {item.parking_spots?.name ?? 'Parking location'}
          </Text>

          <Text style={styles.sessionMeta} numberOfLines={1}>
            {formatDate(item.checked_in_at)} · {timeRange}
          </Text>

          <Text style={styles.sessionMeta} numberOfLines={1}>
            {formatDuration(item.duration_minutes, item.checked_in_at)}
            {item.parking_spots?.address
              ? ` · ${item.parking_spots.address}`
              : ''}
          </Text>
        </View>

        <View style={styles.sessionRight}>
          <Text
            style={
              item.estimated_cost == null
                ? styles.costMuted
                : styles.cost
            }
            numberOfLines={1}
          >
            {costText}
          </Text>

          <View
            style={[
              styles.statusBadge,
              isActive ? styles.statusBadgeActive : styles.statusBadgeDone,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                isActive ? styles.statusTextActive : styles.statusTextDone,
              ]}
            >
              {isActive ? 'Active' : 'Completed'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderSpendSummary = () => {
    if (!spendSummary) return null;

    const difference = spendSummary.month_over_month_diff;
    const trendIcon =
      difference > 0
        ? 'trending-up'
        : difference < 0
          ? 'trending-down'
          : 'remove';

    return (
      <View style={styles.spendCard}>
        <View style={styles.spendTop}>
          <View style={styles.spendMain}>
            <Text style={styles.overline}>THIS MONTH</Text>

            <Text style={styles.spendTotal}>
              ₹{spendSummary.total_this_month.toFixed(2)}
            </Text>

            <Text style={styles.spendSessions}>
              {spendSummary.sessions_this_month} sessions this month
            </Text>
          </View>

          <View style={styles.spendIcon}>
            <Ionicons
              name="wallet-outline"
              size={18}
              color={colors.goldDeep}
            />
          </View>
        </View>

        {spendSummary.total_last_month !== 0 && (
          <View style={styles.comparisonRow}>
            <Ionicons
              name={trendIcon}
              size={15}
              color={colors.textSecondary}
            />
            <Text style={styles.monthComparison}>
              {difference > 0
                ? `Up ₹${difference.toFixed(2)} from last month`
                : difference < 0
                  ? `Down ₹${Math.abs(difference).toFixed(2)} from last month`
                  : 'No change from last month'}
            </Text>
          </View>
        )}

        {spendSummary.area_breakdown.length > 0 && (
          <>
            <View style={styles.divider} />

            <Text style={styles.areaTitle}>Spending by area</Text>

            {spendSummary.area_breakdown.map((item, index) => (
              <View
                key={`${item.area}-${index}`}
                style={styles.areaRow}
              >
                <Text style={styles.areaName} numberOfLines={1}>
                  {item.area}
                </Text>

                <Text style={styles.areaSessions}>
                  {item.sessions} sessions
                </Text>

                <Text style={styles.areaTotal}>
                  ₹{item.total.toFixed(2)}
                </Text>
              </View>
            ))}
          </>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + spacing.md },
        ]}
      >
        <Text style={styles.title}>Parking History</Text>

        <Text style={styles.subtitle}>
          Your parking activity, all in one place.
        </Text>
      </View>

      {loading ? (
        <HistorySkeleton styles={styles} skeletonColor={colors.skeleton} />
      ) : !isSignedIn ? (
        <View style={styles.centerState}>
          <EmptyState
            icon="person-outline"
            heading="Sign in to view your history"
            subtext="Your parking sessions will appear here once you sign in."
          />

          <PrimaryButton
            title="Sign in"
            onPress={openSignIn}
            style={styles.stateButton}
          />
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <EmptyState
            icon="alert-circle-outline"
            heading="Couldn't load history"
            subtext={error}
          />

          <PrimaryButton
            title="Try again"
            onPress={() => void loadHistory()}
            style={styles.stateButton}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadHistory(true)}
              tintColor={colors.primary}
              colors={[colors.primary]}
              progressBackgroundColor={colors.surface}
            />
          }
        >
          {renderSpendSummary()}

          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total sessions</Text>
              <Text style={styles.summaryValue}>{history.length}</Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total spent</Text>
              <Text style={styles.summaryValue}>
                ₹{totalSpent.toFixed(2)}
              </Text>
            </View>
          </View>

          {activeSessions > 0 && (
            <View style={styles.activeBanner}>
              <View style={styles.activeDot} />
              <Text style={styles.activeBannerText}>
                You have {activeSessions} active parking session
                {activeSessions > 1 ? 's' : ''}.
              </Text>
            </View>
          )}

          <Text style={styles.sectionTitle}>Recent activity</Text>

          {history.length === 0 ? (
            <EmptyState
              icon="car-outline"
              heading="No parking history yet"
              subtext="Your completed and active parking sessions will appear here."
            />
          ) : (
            history.map((item, index) => {
              const monthHeading = formatMonthHeading(item.checked_in_at);
              const showMonthHeading =
                index === 0 ||
                monthHeading !==
                  formatMonthHeading(history[index - 1].checked_in_at);

              return (
                <View key={item.id}>
                  {showMonthHeading && (
                    <Text style={styles.monthHeading}>{monthHeading}</Text>
                  )}
                  {renderSession(item)}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const createStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    },
    title: {
      color: colors.text,
      fontSize: typography.title,
      lineHeight: typography.titleLineHeight,
      fontWeight: fontWeight.bold,
      letterSpacing: letterSpacing.tight,
    },
    subtitle: {
      marginTop: spacing.xs,
      color: colors.textSecondary,
      fontSize: typography.small,
      lineHeight: typography.smallLineHeight,
    },
    list: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xl,
    },
    centerState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xl,
    },
    stateButton: {
      alignSelf: 'center',
      minWidth: 180,
      paddingHorizontal: spacing.xl,
    },
    overline: {
      color: colors.goldDeep,
      fontSize: typography.overline,
      lineHeight: typography.overlineLineHeight,
      fontWeight: fontWeight.bold,
      letterSpacing: letterSpacing.overline,
    },

    // Monthly spending
    spendCard: {
      padding: spacing.md,
      borderRadius: radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginBottom: 12,
    },
    spendTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    spendMain: {
      flex: 1,
      minWidth: 0,
    },
    spendTotal: {
      color: colors.text,
      fontSize: 26,
      lineHeight: 32,
      fontWeight: fontWeight.bold,
      letterSpacing: letterSpacing.snug,
      marginTop: 4,
    },
    spendSessions: {
      color: colors.textSecondary,
      fontSize: typography.caption,
      lineHeight: typography.captionLineHeight,
      marginTop: 2,
    },
    spendIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.champagneSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    comparisonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 10,
    },
    monthComparison: {
      color: colors.textSecondary,
      fontSize: 12.5,
      fontWeight: fontWeight.medium,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginVertical: 12,
    },
    areaTitle: {
      color: colors.text,
      fontSize: typography.caption + 1,
      fontWeight: fontWeight.semibold,
      marginBottom: 4,
    },
    areaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: 5,
    },
    areaName: {
      flex: 1,
      color: colors.text,
      fontSize: 13,
    },
    areaSessions: {
      color: colors.textSecondary,
      fontSize: typography.caption,
    },
    areaTotal: {
      minWidth: 64,
      textAlign: 'right',
      color: colors.text,
      fontSize: 13,
      fontWeight: fontWeight.semibold,
    },

    // Summary tiles
    summaryRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 12,
    },
    summaryCard: {
      flex: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      gap: 2,
    },
    summaryLabel: {
      color: colors.textSecondary,
      fontSize: typography.caption,
      lineHeight: typography.captionLineHeight,
    },
    summaryValue: {
      color: colors.text,
      fontSize: 20,
      lineHeight: 26,
      fontWeight: fontWeight.bold,
    },

    // Active banner
    activeBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      borderRadius: radius.pill,
      backgroundColor: colors.primarySoft,
      marginBottom: 12,
    },
    activeDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
    activeBannerText: {
      flex: 1,
      color: colors.primaryDeep,
      fontSize: 13,
      fontWeight: fontWeight.semibold,
    },

    // Activity list
    sectionTitle: {
      color: colors.text,
      fontSize: typography.headline,
      lineHeight: typography.headlineLineHeight,
      fontWeight: fontWeight.bold,
      letterSpacing: letterSpacing.snug,
      marginTop: spacing.sm,
    },
    monthHeading: {
      color: colors.goldDeep,
      fontSize: typography.overline,
      lineHeight: typography.overlineLineHeight,
      fontWeight: fontWeight.bold,
      letterSpacing: letterSpacing.overline,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    sessionCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      padding: 14,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginBottom: 10,
    },
    sessionIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sessionIconActive: {
      backgroundColor: colors.primarySoft,
    },
    sessionIconDone: {
      backgroundColor: colors.surfaceMuted,
    },
    sessionInfo: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    spotName: {
      color: colors.text,
      fontSize: 15.5,
      lineHeight: 20,
      fontWeight: fontWeight.semibold,
    },
    sessionMeta: {
      color: colors.textSecondary,
      fontSize: typography.caption,
      lineHeight: 17,
    },
    sessionRight: {
      alignItems: 'flex-end',
      gap: 6,
      maxWidth: 110,
    },
    cost: {
      color: colors.text,
      fontSize: 16,
      lineHeight: 20,
      fontWeight: fontWeight.bold,
    },
    costMuted: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 20,
      fontWeight: fontWeight.medium,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.pill,
    },
    statusBadgeActive: {
      backgroundColor: colors.primarySoft,
    },
    statusBadgeDone: {
      backgroundColor: colors.surfaceMuted,
    },
    statusText: {
      fontSize: 11,
      fontWeight: fontWeight.semibold,
    },
    statusTextActive: {
      color: colors.primaryDeep,
    },
    statusTextDone: {
      color: colors.textSecondary,
    },
  });
