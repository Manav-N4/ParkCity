
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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../App';
import { setParkingReminder } from '../lib/api';
import { scheduleParkingReminder } from '../lib/notifications';
import { useTheme } from '../contexts/ThemeContext';
import { spacing, fontWeight } from '../constants/tokens';

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
      Alert.alert(
        'Invalid duration',
        'Please enter a valid number of minutes greater than zero.',
      );
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

      Alert.alert(
        'Reminder set!',
        `We'll remind you about your parking at ${spotName} in ${reminderMinutes} minute${reminderMinutes === 1 ? '' : 's'}.`,
        [
          {
            text: 'Done',
            onPress: () => navigation.replace('MainTabs'),
          },
        ],
      );
    } catch (error) {
      Alert.alert(
        'Could not set reminder',
        error instanceof Error
          ? error.message
          : 'Something went wrong. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    navigation.replace('MainTabs');
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={handleSkip}
          style={styles.skipButton}
        >
          <Text style={[styles.skipText, { color: colors.textSecondary }]}>
            Skip for now
          </Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>
            PARKING REMINDER
          </Text>

          <Text style={[styles.title, { color: colors.text }]}>
            Set a reminder.
          </Text>

          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Get notified about your parking so you don't lose track of time.
          </Text>
        </View>

        <View
          style={[
            styles.spotCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>
            CURRENTLY PARKED AT
          </Text>

          <Text style={[styles.spotName, { color: colors.text }]}>
            {spotName}
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          When should we remind you?
        </Text>

        <View style={styles.optionsContainer}>
          <Pressable
            onPress={() => setSelectedOption(15)}
            style={[
              styles.optionCard,
              {
                backgroundColor: colors.surface,
                borderColor:
                  selectedOption === 15
                    ? colors.primary
                    : colors.border,
              },
              selectedOption === 15 && styles.selectedOption,
            ]}
          >
            <Text style={[styles.optionValue, { color: colors.text }]}>
              15 minutes
            </Text>

            <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>
              Quick reminder
            </Text>

            {selectedOption === 15 && (
              <Text style={[styles.selectedLabel, { color: colors.primary }]}>
                SELECTED
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => setSelectedOption(30)}
            style={[
              styles.optionCard,
              {
                backgroundColor: colors.surface,
                borderColor:
                  selectedOption === 30
                    ? colors.primary
                    : colors.border,
              },
              selectedOption === 30 && styles.selectedOption,
            ]}
          >
            <Text style={[styles.optionValue, { color: colors.text }]}>
              30 minutes
            </Text>

            <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>
              More preparation time
            </Text>

            {selectedOption === 30 && (
              <Text style={[styles.selectedLabel, { color: colors.primary }]}>
                SELECTED
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => setSelectedOption('custom')}
            style={[
              styles.optionCard,
              {
                backgroundColor: colors.surface,
                borderColor:
                  selectedOption === 'custom'
                    ? colors.primary
                    : colors.border,
              },
              selectedOption === 'custom' && styles.selectedOption,
            ]}
          >
            <Text style={[styles.optionValue, { color: colors.text }]}>
              Custom duration
            </Text>

            <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>
              Choose your own time
            </Text>

            {selectedOption === 'custom' && (
              <Text style={[styles.selectedLabel, { color: colors.primary }]}>
                SELECTED
              </Text>
            )}
          </Pressable>
        </View>

        {selectedOption === 'custom' && (
          <View style={styles.customContainer}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>
              Reminder after (minutes)
            </Text>

            <TextInput
              value={customMinutes}
              onChangeText={setCustomMinutes}
              placeholder="Enter minutes"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              style={[
                styles.customInput,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              editable={!saving}
            />
          </View>
        )}

        <View
          style={[
            styles.notice,
            { backgroundColor: colors.primary + '12' },
          ]}
        >
          <Text style={[styles.noticeText, { color: colors.text }]}>
            ParkCity will send you a notification even when the app is closed.
          </Text>
        </View>

        <Pressable
          onPress={handleSetReminder}
          disabled={saving}
          style={({ pressed }) => [
            styles.submitButton,
            { backgroundColor: colors.primary },
            pressed && !saving && styles.buttonPressed,
            saving && styles.buttonDisabled,
          ]}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitText}>
              Set reminder
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: 60,
    paddingBottom: spacing.xl,
  },
  skipButton: {
    alignSelf: 'flex-end',
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
  skipText: {
    fontSize: 14,
    fontWeight: fontWeight.medium,
  },
  header: {
    marginBottom: spacing.xl,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: fontWeight.bold,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.xs,
  },
  spotCard: {
    padding: spacing.lg,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: spacing.xl,
  },
  cardLabel: {
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  spotName: {
    fontSize: 18,
    fontWeight: fontWeight.bold,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.md,
  },
  optionsContainer: {
    gap: spacing.md,
  },
  optionCard: {
    padding: spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
  },
  selectedOption: {
    borderWidth: 2,
  },
  optionValue: {
    fontSize: 16,
    fontWeight: fontWeight.bold,
  },
  optionDescription: {
    fontSize: 13,
    marginTop: spacing.xs,
  },
  selectedLabel: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    letterSpacing: 1,
    marginTop: spacing.md,
  },
  customContainer: {
    marginTop: spacing.lg,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  customInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
  },
  notice: {
    padding: spacing.md,
    borderRadius: 13,
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 20,
  },
  submitButton: {
    minHeight: 54,
    padding: spacing.lg,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: fontWeight.semibold,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
});
