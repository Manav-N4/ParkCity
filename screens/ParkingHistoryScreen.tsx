
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { MainTabParamList } from '../navigation/MainTabNavigator';
import type { RootStackParamList } from '../App';

import { getParkingHistory, type ParkingHistoryItem } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { spacing, fontWeight } from '../constants/tokens';
import EmptyState from '../components/ui/EmptyState';

type Props = BottomTabNavigationProp<MainTabParamList>;

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

export default function ParkingHistoryScreen() {
  const { colors } = useTheme();

  const navigation = useNavigation<Props>();
  const [history, setHistory] = useState<ParkingHistoryItem[]>([]);
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
        return;
      }

      setIsSignedIn(true);

      const result = await getParkingHistory(session.access_token);
      setHistory(result);
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

    return (
      <View
        key={item.id}
        style={[
          styles.sessionCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.cardTop}>
          <View style={styles.spotInfo}>
            <Text style={[styles.spotName, { color: colors.text }]}>
              {item.parking_spots?.name ?? 'Parking location'}
            </Text>

            {!!item.parking_spots?.address && (
              <Text
                style={[
                  styles.address,
                  { color: colors.textSecondary },
                ]}
                numberOfLines={2}
              >
                {item.parking_spots.address}
              </Text>
            )}
          </View>

          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: isActive
                  ? colors.primary + '18'
                  : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                { color: isActive ? colors.primary : colors.textSecondary },
              ]}
            >
              {isActive ? 'Active' : 'Completed'}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.divider,
            { backgroundColor: colors.border },
          ]}
        />

        <View style={styles.detailsRow}>
          <View style={styles.detailItem}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
              Date
            </Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {formatDate(item.checked_in_at)}
            </Text>
          </View>

          <View style={styles.detailItem}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
              Duration
            </Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {formatDuration(item.duration_minutes, item.checked_in_at)}
            </Text>
          </View>

          <View style={styles.detailItem}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
              Cost
            </Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {item.estimated_cost == null
                ? isActive
                  ? 'Ongoing'
                  : 'Unavailable'
                : `₹${item.estimated_cost.toFixed(2)}`}
            </Text>
          </View>
        </View>

        <Text style={[styles.timeText, { color: colors.textSecondary }]}>
          Checked in at {formatTime(item.checked_in_at)}
          {item.checked_out_at
            ? ` · Checked out at ${formatTime(item.checked_out_at)}`
            : ''}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>
          Parking History
        </Text>

        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Your parking activity, all in one place.
        </Text>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.stateText, { color: colors.textSecondary }]}>
            Loading parking history...
          </Text>
        </View>
      ) : !isSignedIn ? (
        <View style={styles.centerState}>
          <EmptyState
            icon="person-outline"
            heading="Sign in to view your history"
            subtext="Your parking sessions will appear here once you sign in."
          />

          <Pressable
            onPress={openSignIn}
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.actionButtonText}>Sign in</Text>
          </Pressable>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <EmptyState
            icon="alert-circle-outline"
            heading="Couldn't load history"
            subtext={error}
          />

          <Pressable
            onPress={() => void loadHistory()}
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.actionButtonText}>Try again</Text>
          </Pressable>
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
            />
          }
        >
          <View style={styles.summaryRow}>
            <View
              style={[
                styles.summaryCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                Total sessions
              </Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {history.length}
              </Text>
            </View>

            <View
              style={[
                styles.summaryCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                Total spent
              </Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                ₹{totalSpent.toFixed(2)}
              </Text>
            </View>
          </View>

          {activeSessions > 0 && (
            <View
              style={[
                styles.activeBanner,
                { backgroundColor: colors.primary + '15' },
              ]}
            >
              <Text style={[styles.activeBannerText, { color: colors.primary }]}>
                You have {activeSessions} active parking session
                {activeSessions > 1 ? 's' : ''}.
              </Text>
            </View>
          )}

          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Recent activity
          </Text>

          {history.length === 0 ? (
            <EmptyState
              icon="car-outline"
              heading="No parking history yet"
              subtext="Your completed and active parking sessions will appear here."
            />
          ) : (
            history.map(renderSession)
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: 60,
    paddingBottom: spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: fontWeight.bold,
  },
  subtitle: {
    marginTop: spacing.xs,
    fontSize: 14,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  stateText: {
    fontSize: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  summaryCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    gap: spacing.xs,
  },
  summaryLabel: {
    fontSize: 12,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: fontWeight.bold,
  },
  activeBanner: {
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.lg,
  },
  activeBannerText: {
    fontSize: 13,
    fontWeight: fontWeight.semibold,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.md,
  },
  sessionCard: {
    padding: spacing.md,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  spotInfo: {
    flex: 1,
    gap: 4,
  },
  spotName: {
    fontSize: 16,
    fontWeight: fontWeight.semibold,
  },
  address: {
    fontSize: 12,
    lineHeight: 18,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
  },
  divider: {
    height: 1,
    marginVertical: spacing.md,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  detailItem: {
    flex: 1,
    gap: 5,
  },
  detailLabel: {
    fontSize: 11,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: fontWeight.semibold,
  },
  timeText: {
    fontSize: 11,
    marginTop: spacing.md,
  },
  actionButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 12,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: fontWeight.semibold,
  },
});
