
import { View, StyleSheet, type ViewProps } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

type Props = ViewProps & {
  variant?: 'background' | 'surface';
};

export default function ThemedView({
  variant = 'background',
  style,
  ...props
}: Props) {
  const { colors } = useTheme();

  return (
    <View
      {...props}
      style={[
        styles.base,
        {
          backgroundColor:
            variant === 'surface' ? colors.surface : colors.background,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {},
});
