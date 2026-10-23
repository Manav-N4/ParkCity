
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ThemedText from './ThemedText';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing } from '../../constants/tokens';

type Props = {
  icon?: keyof typeof Ionicons.glyphMap;
  heading: string;
  subtext: string;
};

export default function EmptyState({
  icon = 'car-outline',
  heading,
  subtext,
}: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: colors.border },
        ]}
      >
        <Ionicons
          name={icon}
          size={36}
          color={colors.textSecondary}
        />
      </View>

      <ThemedText variant="heading" style={styles.heading}>
        {heading}
      </ThemedText>

      <ThemedText
        variant="body"
        style={[styles.subtext, { color: colors.textSecondary }]}
      >
        {subtext}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  iconContainer: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    textAlign: 'center',
  },
  subtext: {
    textAlign: 'center',
  },
});
