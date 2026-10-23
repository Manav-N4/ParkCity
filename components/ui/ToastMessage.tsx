
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ThemedText from './ThemedText';
import { useTheme } from '../../contexts/ThemeContext';
import { radius, spacing, fontWeight } from '../../constants/tokens';

type Props = {
  message: string;
  type: 'success' | 'error';
};

export default function ToastMessage({ message, type }: Props) {
  const { colors } = useTheme();

  const isSuccess = type === 'success';
  const accentColor = isSuccess ? colors.success : colors.error;

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: accentColor,
        },
      ]}
    >
      <Ionicons
        name={isSuccess ? 'checkmark-circle' : 'alert-circle'}
        size={22}
        color={accentColor}
      />

      <ThemedText style={styles.message}>
        {message}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  message: {
    flex: 1,
    fontWeight: fontWeight.medium,
  },
});
