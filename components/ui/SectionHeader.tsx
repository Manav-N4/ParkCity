
import { View, StyleSheet, Pressable } from 'react-native';
import ThemedText from './ThemedText';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing } from '../../constants/tokens';

type Props = {
  title: string;
  actionLabel?: string;
  onActionPress?: () => void;
};

export default function SectionHeader({
  title,
  actionLabel,
  onActionPress,
}: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <ThemedText variant="heading" style={styles.title}>
        {title}
      </ThemedText>

      {actionLabel && onActionPress && (
        <Pressable
          onPress={onActionPress}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          hitSlop={8}
        >
          <ThemedText
            variant="label"
            style={{ color: colors.primary }}
          >
            {actionLabel}
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    flexShrink: 1,
  },
});
