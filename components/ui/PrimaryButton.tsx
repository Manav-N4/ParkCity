
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
  size,
  radius,
  spacing,
  typography,
} from '../../constants/tokens';

type Props = Omit<PressableProps, 'children'> & {
  title: string;
  loading?: boolean;
  disabled?: boolean;
};

export default function PrimaryButton({
  title,
  loading = false,
  disabled = false,
  style,
  ...props
}: Props) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;

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
          backgroundColor: colors.primary,
          opacity: isDisabled ? 0.55 : state.pressed ? 0.85 : 1,
        },
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.white} />
      ) : (
        <Text style={[styles.text, { color: colors.white }]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: size.buttonHeight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: typography.body,
    fontWeight: fontWeight.semibold,
  },
});
