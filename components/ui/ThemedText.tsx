
import { Text, StyleSheet, type TextProps } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { typography, fontWeight } from '../../constants/tokens';

type TextVariant = 'body' | 'label' | 'caption' | 'heading';

type Props = TextProps & {
  variant?: TextVariant;
};

export default function ThemedText({
  variant = 'body',
  style,
  ...props
}: Props) {
  const { colors } = useTheme();

  return (
    <Text
      {...props}
      style={[
        styles.base,
        {
          color: colors.text,
        },
        styles[variant],
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    fontWeight: fontWeight.regular,
  },
  body: {
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  label: {
    fontSize: typography.small,
    lineHeight: typography.smallLineHeight,
    fontWeight: fontWeight.semibold,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
  },
  heading: {
    fontSize: typography.heading,
    lineHeight: typography.headingLineHeight,
    fontWeight: fontWeight.bold,
  },
});
