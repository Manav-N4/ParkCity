
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import {
  fontWeight,
  letterSpacing,
  size,
  radius,
  spacing,
  typography,
} from '../../constants/tokens';

type ButtonVariant =
  | 'primary'
  | 'destructive'
  | 'outline'
  | 'destructiveOutline';

type Props = Omit<PressableProps, 'children'> & {
  title: string;
  loading?: boolean;
  disabled?: boolean;
  variant?: ButtonVariant;
};

export default function PrimaryButton({
  title,
  loading = false,
  disabled = false,
  variant = 'primary',
  style,
  ...props
}: Props) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;

  const variantColors = {
    primary: {
      background: colors.primary,
      border: colors.primary,
      label: colors.white,
    },
    destructive: {
      background: colors.errorStrong,
      border: colors.errorStrong,
      label: colors.white,
    },
    outline: {
      background: 'transparent',
      border: colors.primary,
      label: colors.primaryDeep,
    },
    destructiveOutline: {
      background: 'transparent',
      // errorText: the readable red for text on light and dark surfaces.
      border: colors.errorText,
      label: colors.errorText,
    },
  }[variant];

  return (
    <Pressable
      {...props}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{
        disabled: isDisabled,
        busy: loading,
      }}
      style={(state) => [
        styles.button,
        {
          backgroundColor: variantColors.background,
          borderColor: variantColors.border,
          opacity: isDisabled ? 0.5 : state.pressed ? 0.85 : 1,
        },
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variantColors.label} />
      ) : (
        <Text style={[styles.text, { color: variantColors.label }]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: size.buttonHeightLarge,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: typography.body,
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.wide,
  },
});
