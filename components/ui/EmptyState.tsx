
import { View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import {
  fontWeight,
  letterSpacing,
  spacing,
  typography,
} from '../../constants/tokens';

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
          {
            backgroundColor: colors.champagneSoft,
            borderColor: colors.champagne,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={30}
          color={colors.goldDeep}
        />
      </View>

      <Text style={[styles.heading, { color: colors.text }]}>
        {heading}
      </Text>

      <Text style={[styles.subtext, { color: colors.textSecondary }]}>
        {subtext}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heading: {
    textAlign: 'center',
    fontSize: typography.headline,
    lineHeight: typography.headlineLineHeight,
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.snug,
  },
  subtext: {
    marginTop: spacing.xs + 2,
    maxWidth: 300,
    textAlign: 'center',
    fontSize: typography.small,
    lineHeight: 21,
  },
});
