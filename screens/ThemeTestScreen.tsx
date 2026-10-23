
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../App';
import { useTheme } from '../contexts/ThemeContext';
import {
  spacing,
  radius,
  fontWeight,
} from '../constants/tokens';

import ThemedText from '../components/ui/ThemedText';
import ThemedView from '../components/ui/ThemedView';
import PrimaryButton from '../components/ui/PrimaryButton';
import SearchBar from '../components/ui/SearchBar';
import SectionHeader from '../components/ui/SectionHeader';
import EmptyState from '../components/ui/EmptyState';
import SkeletonCard from '../components/ui/SkeletonCard';
import ToastMessage from '../components/ui/ToastMessage';

type Props = NativeStackScreenProps<
  RootStackParamList,
  'ThemeTest'
>;

export default function ThemeTestScreen({ navigation }: Props) {
  const { colors, isDark, toggleTheme } = useTheme();

  return (
    <ThemedView variant="background" style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <ThemedText variant="heading">
              ParkCity UI Lab
            </ThemedText>

            <ThemedText variant="caption">
              Story 3B · Design System Verification
            </ThemedText>
          </View>

          <Pressable
            onPress={toggleTheme}
            accessibilityRole="button"
            accessibilityLabel="Toggle light and dark theme"
            style={[
              styles.themeButton,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <ThemedText variant="label">
              {isDark ? 'Dark mode' : 'Light mode'}
            </ThemedText>

            <ThemedText variant="caption">
              Tap to switch
            </ThemedText>
          </Pressable>
        </View>

        <ThemedText variant="caption">
          Current theme: {isDark ? 'Dark' : 'Light'}
        </ThemedText>

        <View
          style={[
            styles.panel,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <SectionHeader title="1. ThemedText" />

          <ThemedText variant="heading">
            Find your parking.
          </ThemedText>

          <ThemedText variant="body">
            Body text adapts to the selected theme.
          </ThemedText>

          <ThemedText variant="label">
            LABEL VARIANT
          </ThemedText>

          <ThemedText variant="caption">
            Caption variant
          </ThemedText>
        </View>

        <View
          style={[
            styles.panel,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <SectionHeader title="2. ThemedView" />

          <ThemedView
            variant="surface"
            style={[
              styles.preview,
              { borderColor: colors.border },
            ]}
          >
            <ThemedText>
              Background and surface colors update with the theme.
            </ThemedText>
          </ThemedView>
        </View>

        <View
          style={[
            styles.panel,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <SectionHeader title="3. PrimaryButton" />

          <PrimaryButton
            title="Primary action"
            onPress={() => {}}
          />

          <PrimaryButton
            title="Disabled action"
            disabled
            onPress={() => {}}
          />
        </View>

        <View
          style={[
            styles.panel,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <SectionHeader title="4. SearchBar" />

          <SearchBar
            onSelectSuggestion={() => {}}
          />

          <ThemedText variant="caption">
            Try typing a place to check suggestions and the clear button.
          </ThemedText>
        </View>

        <View
          style={[
            styles.panel,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <SectionHeader
            title="5. SectionHeader"
            actionLabel="View all"
            onActionPress={() => {}}
          />

          <ThemedText variant="body">
            Header and action text should remain readable in both themes.
          </ThemedText>
        </View>

        <View
          style={[
            styles.panel,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <SectionHeader title="6. EmptyState" />

          <EmptyState
            icon="car-outline"
            heading="No parking spots yet"
            subtext="Try searching for another destination."
          />
        </View>

        <View
          style={[
            styles.panel,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <SectionHeader title="7. SkeletonCard" />

          <SkeletonCard />

          <ThemedText variant="caption">
            The placeholder should animate while matching the theme.
          </ThemedText>
        </View>

        <View
          style={[
            styles.panel,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <SectionHeader title="8. ToastMessage" />

          <ToastMessage
            type="success"
            message="Parking details updated successfully."
          />

          <ToastMessage
            type="error"
            message="Unable to load parking details."
          />
        </View>

        <PrimaryButton
          title="Return to ParkCity Home"
          onPress={() => navigation.navigate('Home')}
        />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  content: {
    paddingTop: 56,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },

  headerCopy: {
    flex: 1,
    gap: spacing.xs,
  },

  themeButton: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    gap: spacing.xs,
  },

  panel: {
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
    gap: spacing.md,
  },

  preview: {
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
  },
});
