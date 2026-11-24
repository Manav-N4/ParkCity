
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { fontWeight, radius, spacing } from '../../constants/tokens';

type IoniconName = keyof typeof Ionicons.glyphMap;

type Props = {
  title: string;
  description?: string;
  icon?: IoniconName;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
};

export default function OptionCard({
  title,
  description,
  icon,
  selected,
  onPress,
  disabled = false,
  accessibilityLabel,
}: Props) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ selected, checked: selected, disabled }}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: selected ? colors.primary : colors.border,
          borderWidth: selected ? 1.5 : StyleSheet.hairlineWidth,
        },
        pressed && !selected && { backgroundColor: colors.surfaceMuted },
        disabled && styles.disabled,
      ]}
    >
      {icon && (
        <View
          style={[
            styles.iconCircle,
            {
              backgroundColor: selected
                ? colors.primarySoft
                : colors.champagneSoft,
            },
          ]}
        >
          <Ionicons
            name={icon}
            size={18}
            color={selected ? colors.primaryDeep : colors.goldDeep}
          />
        </View>
      )}

      <View style={styles.text}>
        <Text style={[styles.title, { color: colors.text }]}>
          {title}
        </Text>

        {description ? (
          <Text
            style={[styles.description, { color: colors.textSecondary }]}
          >
            {description}
          </Text>
        ) : null}
      </View>

      <View
        style={[
          styles.radio,
          selected
            ? {
                backgroundColor: colors.primary,
                borderColor: colors.primary,
              }
            : { borderColor: colors.textSecondary },
        ]}
      >
        {selected && (
          <Ionicons name="checkmark" size={14} color={colors.white} />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.lg,
  },
  disabled: {
    opacity: 0.5,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: fontWeight.semibold,
  },
  description: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
