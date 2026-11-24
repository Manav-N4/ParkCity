
import { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../contexts/ThemeContext';
import { fontWeight, radius, spacing, typography } from '../../constants/tokens';

// "12:00 AM" … "11:30 PM" in 30-minute steps.
export const TIME_OPTIONS: string[] = Array.from({ length: 48 }, (_, index) => {
  const hours24 = Math.floor(index / 2);
  const minutes = index % 2 === 0 ? '00' : '30';
  const period = hours24 < 12 ? 'AM' : 'PM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;

  return `${hours12}:${minutes} ${period}`;
});

const ROW_HEIGHT = 48;
const DEFAULT_SCROLL_VALUE = '9:00 AM';

type Props = {
  label: string;
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: boolean;
  disabled?: boolean;
};

export default function TimeSelect({
  label,
  value,
  onChange,
  placeholder = 'Select time',
  error = false,
  disabled = false,
}: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const scrollIndex = Math.max(
    0,
    TIME_OPTIONS.indexOf(value ?? DEFAULT_SCROLL_VALUE) - 2,
  );

  const handleSelect = (time: string) => {
    onChange(time);
    setOpen(false);
  };

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>

      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${value ?? 'not selected'}`}
        accessibilityHint="Opens a list of times"
        style={({ pressed }) => [
          styles.field,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.errorText : colors.textSecondary,
            borderWidth: error ? 1.5 : 1,
          },
          pressed && { backgroundColor: colors.surfaceMuted },
          disabled && styles.disabled,
        ]}
      >
        <Ionicons name="time-outline" size={17} color={colors.textSecondary} />
        <Text
          style={[
            styles.value,
            { color: value ? colors.text : colors.textSecondary },
          ]}
          numberOfLines={1}
        >
          {value ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
            onPress={() => setOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close time list"
          />

          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surface,
                paddingBottom: Math.max(insets.bottom, spacing.md),
              },
            ]}
          >
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>
                {label}
              </Text>
              <Pressable
                onPress={() => setOpen(false)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={[styles.cancelText, { color: colors.textSecondary }]}>
                  Cancel
                </Text>
              </Pressable>
            </View>

            <FlatList
              data={TIME_OPTIONS}
              keyExtractor={(item) => item}
              initialScrollIndex={scrollIndex}
              getItemLayout={(_, index) => ({
                length: ROW_HEIGHT,
                offset: ROW_HEIGHT * index,
                index,
              })}
              style={styles.list}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const selected = item === value;

                return (
                  <Pressable
                    onPress={() => handleSelect(item)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={({ pressed }) => [
                      styles.row,
                      selected && { backgroundColor: colors.primarySoft },
                      pressed && !selected && {
                        backgroundColor: colors.surfaceMuted,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.rowText,
                        {
                          color: selected ? colors.primaryDeep : colors.text,
                          fontWeight: selected
                            ? fontWeight.semibold
                            : fontWeight.regular,
                        },
                      ]}
                    >
                      {item}
                    </Text>
                    {selected && (
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color={colors.primaryDeep}
                      />
                    )}
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontSize: typography.small,
    fontWeight: fontWeight.medium,
    marginBottom: 6,
  },
  field: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 12,
    borderRadius: radius.lg,
  },
  value: {
    flex: 1,
    fontSize: typography.body - 1,
  },
  disabled: {
    opacity: 0.5,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingTop: spacing.md,
    maxHeight: '60%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sheetTitle: {
    fontSize: typography.headline,
    fontWeight: fontWeight.bold,
  },
  cancelText: {
    fontSize: typography.small,
    fontWeight: fontWeight.semibold,
  },
  list: {
    flexGrow: 0,
  },
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  rowText: {
    fontSize: typography.body,
  },
});
