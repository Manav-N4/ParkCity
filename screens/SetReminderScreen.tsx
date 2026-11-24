
import { useMemo, useState } from 'react';
import {
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

import type { RootStackParamList } from '../App';
import { setParkingReminder } from '../lib/api';
import { scheduleParkingReminder } from '../lib/notifications';
import { useTheme } from '../contexts/ThemeContext';
import { useDialog } from '../contexts/DialogContext';
import {
  colors as lightColors,
  fontWeight,
  letterSpacing,
  radius,
  spacing,
  typography,
} from '../constants/tokens';
import OptionCard from '../components/ui/OptionCard';
import { useKeyboardAwareScroll } from '../hooks/useKeyboardAwareScroll';
import PrimaryButton from '../components/ui/PrimaryButton';

type Props = NativeStackScreenProps<
  RootStackParamList,
  'SetReminder'
>;

type ReminderOption = 15 | 30 | 'custom';

export default function SetReminderScreen({
  route,
  navigation,
}: Props) {
  const { sessionId, spotName, accessToken } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardAwareScroll();
  const { showDialog } = useDialog();

  const [selectedOption, setSelectedOption] =
    useState<ReminderOption>(15);
  const [customMinutes, setCustomMinutes] = useState('1');
  const [saving, setSaving] = useState(false);

  const reminderMinutes =
    selectedOption === 'custom'
      ? Number(customMinutes)
      : selectedOption;

  const handleSetReminder = async () => {
    if (saving) return;

    if (
      !Number.isInteger(reminderMinutes) ||
      reminderMinutes <= 0
    ) {
      showDialog({
        type: 'warning',
        title: 'Invalid duration',
        message: 'Please enter a valid number of minutes greater than zero.',
      });
      return;
    }

    setSaving(true);

    try {
      await setParkingReminder(
        accessToken,
        sessionId,
        reminderMinutes,
      );

      await scheduleParkingReminder(
        sessionId,
        spotName,
        reminderMinutes,
      );

      showDialog({
        type: 'success',
        title: 'Reminder set!',
        message: `We'll remind you about your parking at ${spotName} in ${reminderMinutes} minute${reminderMinutes === 1 ? '' : 's'}.`,
        actions: [
          {
            label: 'Done',
            onPress: () => navigation.replace('MainTabs'),
          },
        ],
      });
    } catch (error) {
      showDialog({
        type: 'error',
        title: 'Could not set reminder',
        message:
          error instanceof Error
            ? error.message
            : 'Something went wrong. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    navigation.replace('MainTabs');
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        ref={keyboard.scrollRef}
        onScroll={keyboard.handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: insets.top + spacing.sm,
            paddingBottom: spacing.xl + keyboard.keyboardHeight,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={handleSkip}
          style={styles.skipButton}
          accessibilityRole="button"
          accessibilityLabel="Skip for now"
          hitSlop={8}
        >
          <Text style={styles.skipText}>Skip for now</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.eyebrow}>PARKING REMINDER</Text>

          <Text style={styles.title}>Set a reminder</Text>

          <Text style={styles.subtitle}>
            Get notified about your parking so you don't lose track of time.
          </Text>
        </View>

        <View style={styles.spotCard}>
          <View style={styles.spotIcon}>
            <Ionicons name="car" size={18} color={colors.primary} />
          </View>

          <View style={styles.spotText}>
            <Text style={styles.cardLabel}>CURRENTLY PARKED AT</Text>

            <Text style={styles.spotName} numberOfLines={2}>
              {spotName}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>
          When should we remind you?
        </Text>

        <View style={styles.optionsContainer}>
          <OptionCard
            icon="timer-outline"
            title="15 minutes"
            description="Quick reminder"
            selected={selectedOption === 15}
            onPress={() => setSelectedOption(15)}
          />

          <OptionCard
            icon="alarm-outline"
            title="30 minutes"
            description="More preparation time"
            selected={selectedOption === 30}
            onPress={() => setSelectedOption(30)}
          />

          <OptionCard
            icon="create-outline"
            title="Custom duration"
            description="Choose your own time"
            selected={selectedOption === 'custom'}
            onPress={() => setSelectedOption('custom')}
          />
        </View>

        {selectedOption === 'custom' && (
          <View style={styles.customContainer}>
            <Text style={styles.inputLabel}>
              Reminder after (minutes)
            </Text>

            <View style={styles.customInputRow}>
              <TextInput
                value={customMinutes}
                onChangeText={setCustomMinutes}
                placeholder="Enter minutes"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                style={styles.customInput}
                editable={!saving}
                onFocus={keyboard.revealOnFocus}
                accessibilityLabel="Reminder after, in minutes"
              />

              <Text style={styles.customSuffix}>min</Text>
            </View>
          </View>
        )}

        <View style={styles.notice}>
          <Ionicons
            name="notifications-outline"
            size={17}
            color={colors.textSecondary}
          />
          <Text style={styles.noticeText}>
            ParkCity will send you a notification even when the app is closed.
          </Text>
        </View>

        <PrimaryButton
          title="Set reminder"
          onPress={handleSetReminder}
          loading={saving}
          disabled={saving}
        />
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xl,
    },
    skipButton: {
      alignSelf: 'flex-end',
      paddingVertical: spacing.sm,
      marginBottom: spacing.sm,
    },
    skipText: {
      color: colors.textSecondary,
      fontSize: typography.small,
      fontWeight: fontWeight.semibold,
    },
    header: {
      marginBottom: spacing.lg,
    },
    eyebrow: {
      color: colors.goldDeep,
      fontSize: typography.overline,
      lineHeight: typography.overlineLineHeight,
      fontWeight: fontWeight.bold,
      letterSpacing: letterSpacing.overline,
      marginBottom: spacing.xs,
    },
    title: {
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

    // Parked-at card
    spotCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderRadius: radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginBottom: spacing.lg,
    },
    spotIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    spotText: {
      flex: 1,
      minWidth: 0,
    },
    cardLabel: {
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

    // Options
    sectionTitle: {
      color: colors.text,
      fontSize: 16,
      lineHeight: 22,
      fontWeight: fontWeight.bold,
      marginBottom: 12,
    },
    optionsContainer: {
      gap: 10,
    },
    customContainer: {
      marginTop: spacing.md,
    },
    inputLabel: {
      color: colors.text,
      fontSize: typography.small,
      fontWeight: fontWeight.semibold,
      marginBottom: spacing.sm,
    },
    customInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 50,
      paddingHorizontal: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
    },
    customInput: {
      flex: 1,
      paddingVertical: 12,
      color: colors.text,
      fontSize: typography.body,
    },
    customSuffix: {
      color: colors.textSecondary,
      fontSize: typography.small,
      fontWeight: fontWeight.medium,
    },

    // Notice
    notice: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      padding: 12,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceMuted,
      marginTop: spacing.lg,
      marginBottom: spacing.lg,
    },
    noticeText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 12.5,
      lineHeight: 18,
    },
  });
