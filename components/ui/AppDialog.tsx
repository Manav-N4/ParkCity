
import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTheme } from '../../contexts/ThemeContext';
import {
  fontWeight,
  radius,
  shadow,
  spacing,
  typography,
} from '../../constants/tokens';

export type DialogType =
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'confirmation';

export type DialogAction = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'destructive';
};

export type DialogConfig = {
  type: DialogType;
  title: string;
  message: string;
  actions?: DialogAction[];
  dismissible?: boolean;
};

type AppDialogProps = {
  visible: boolean;
  config: DialogConfig | null;
  onClose: () => void;
};

const dialogIcons: Record<DialogType, string> = {
  success: '✓',
  error: '×',
  warning: '!',
  info: 'i',
  confirmation: '?',
};

export default function AppDialog({
  visible,
  config,
  onClose,
}: AppDialogProps) {
  const { colors } = useTheme();

  if (!config) return null;

  const {
    type,
    title,
    message,
    dismissible = true,
  } = config;

  const actions = config.actions?.length
    ? config.actions
    : [{ label: 'Okay', variant: 'primary' as const }];

  const statusColor =
    type === 'success'
      ? colors.success
      : type === 'error'
        ? colors.error
        : type === 'warning'
          ? colors.warning
          : colors.primary;

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
    },
    backdrop: {
      ...StyleSheet.absoluteFill,
    },
    dialog: {
      width: '100%',
      maxWidth: 380,
      backgroundColor: colors.surface,
      borderRadius: radius.lg + 4,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      ...shadow.md,
      shadowColor: colors.shadow,
      elevation: 8,
    },
    iconContainer: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: `${statusColor}18`,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginBottom: spacing.md,
    },
    icon: {
      fontSize: 27,
      fontWeight: fontWeight.bold,
      color: statusColor,
    },
    title: {
      fontSize: 20,
      fontWeight: fontWeight.bold,
      color: colors.text,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    message: {
      fontSize: typography.small,
      lineHeight: typography.bodyLineHeight,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.lg,
    },
    actions: {
      gap: spacing.sm,
    },
    actionButton: {
      minHeight: 48,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
    },
    primaryButton: {
      backgroundColor: colors.primary,
    },
    secondaryButton: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    destructiveButton: {
      backgroundColor: colors.error,
    },
    primaryText: {
      color: colors.white,
    },
    secondaryText: {
      color: colors.text,
    },
    destructiveText: {
      color: colors.white,
    },
    buttonText: {
      fontSize: typography.body,
      fontWeight: fontWeight.semibold,
    },
  });

  const handleAction = (action: DialogAction) => {
    onClose();
    action.onPress?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={dismissible ? onClose : undefined}
    >
      <View style={styles.overlay}>
        {dismissible && (
          <Pressable
            style={styles.backdrop}
            onPress={onClose}
            accessibilityLabel="Close dialog"
          />
        )}

        <View
          style={styles.dialog}
          accessibilityRole="alert"
          accessibilityViewIsModal
        >
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>
              {dialogIcons[type]}
            </Text>
          </View>

          <Text style={styles.title}>{title}</Text>

          <Text style={styles.message}>{message}</Text>

          <View style={styles.actions}>
            {actions.map((action, index) => {
              const variant = action.variant ?? 'primary';

              const buttonStyle =
                variant === 'secondary'
                  ? styles.secondaryButton
                  : variant === 'destructive'
                    ? styles.destructiveButton
                    : styles.primaryButton;

              const textStyle =
                variant === 'secondary'
                  ? styles.secondaryText
                  : variant === 'destructive'
                    ? styles.destructiveText
                    : styles.primaryText;

              return (
                <Pressable
                  key={`${action.label}-${index}`}
                  style={({ pressed }) => [
                    styles.actionButton,
                    buttonStyle,
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => handleAction(action)}
                  accessibilityRole="button"
                >
                  <Text style={[styles.buttonText, textStyle]}>
                    {action.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}
