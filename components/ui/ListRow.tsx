
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { fontWeight, spacing } from '../../constants/tokens';

type IoniconName = keyof typeof Ionicons.glyphMap;

type Props = {
  icon: IoniconName;
  label: string;
  subtitle?: string;
  onPress: () => void;
  destructive?: boolean;
  showDivider?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
};

const ICON_SIZE = 36;

export default function ListRow({
  icon,
  label,
  subtitle,
  onPress,
  destructive = false,
  showDivider = false,
  disabled = false,
  accessibilityLabel,
}: Props) {
  const { colors } = useTheme();

  const iconBackground = destructive
    ? colors.errorSoft
    : colors.primarySoft;
  const iconColor = destructive ? colors.errorText : colors.primaryDeep;
  const labelColor = destructive ? colors.errorText : colors.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: colors.surfaceMuted },
        disabled && styles.disabled,
      ]}
    >
      <View
        style={[styles.iconCircle, { backgroundColor: iconBackground }]}
      >
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>

      <View style={styles.text}>
        <Text style={[styles.label, { color: labelColor }]}>
          {label}
        </Text>

        {subtitle ? (
          <Text
            style={[styles.subtitle, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      <Ionicons
        name="chevron-forward"
        size={18}
        color={colors.textSecondary}
      />

      {showDivider && (
        <View
          style={[styles.divider, { backgroundColor: colors.border }]}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  disabled: {
    opacity: 0.5,
  },
  iconCircle: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  label: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: fontWeight.semibold,
  },
  subtitle: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  divider: {
    position: 'absolute',
    left: spacing.md + ICON_SIZE + 12,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
  },
});
