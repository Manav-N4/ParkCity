
import { useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import {
  colors as lightColors,
  radius,
  size,
  spacing,
  typography,
  fontWeight,
} from '../../constants/tokens';

export type Suggestion = {
  google_place_id: string;
  description: string;
};

type SearchBarProps = {
  onSelectSuggestion: (
    suggestion: Suggestion,
    sessionToken: string
  ) => void;
};

const API_BASE_URL = 'https://parkcity.onrender.com';

export default function SearchBar({
  onSelectSuggestion,
}: SearchBarProps) {
  const { colors } = useTheme();
  const [searchText, setSearchText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [sessionToken, setSessionToken] = useState(
    () => `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  useEffect(() => {
    const query = searchText.trim();

    if (!query) {
      setSuggestions([]);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/autocomplete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: query,
            sessiontoken: sessionToken,
          }),
        });

        if (!response.ok) {
          throw new Error(
            `Autocomplete request failed: ${response.status}`
          );
        }

        const data: Suggestion[] = await response.json();
        setSuggestions(data);
      } catch (error) {
        console.error('Autocomplete error:', error);
        setSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchText, sessionToken]);

  const handleSelectSuggestion = (suggestion: Suggestion) => {
    setSearchText(suggestion.description);
    setSuggestions([]);
    setIsFocused(false);

    onSelectSuggestion(suggestion, sessionToken);

    setSessionToken(
      `${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
  };

  const handleClear = () => {
    setSearchText('');
    setSuggestions([]);
  };

  const showSuggestions =
    isFocused &&
    searchText.trim().length > 0 &&
    suggestions.length > 0;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: colors.surface,
            borderColor: isFocused ? colors.primary : colors.border,
          },
        ]}
      >
        <Ionicons
          name="search-outline"
          size={size.iconMedium}
          color={colors.textSecondary}
        />

        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholder="Search a destination"
          placeholderTextColor={colors.textSecondary}
          value={searchText}
          onChangeText={setSearchText}
          onFocus={() => setIsFocused(true)}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search a destination"
        />

        {searchText.length > 0 && (
          <Pressable
            onPress={handleClear}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            style={styles.clearButton}
          >
            <Ionicons
              name="close-circle"
              size={size.iconMedium}
              color={colors.textSecondary}
            />
          </Pressable>
        )}
      </View>

      {showSuggestions && (
        <View
          style={[
            styles.dropdown,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.google_place_id}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [
                  styles.suggestionItem,
                  {
                    borderBottomColor: colors.border,
                    backgroundColor: pressed
                      ? colors.background
                      : colors.surface,
                  },
                ]}
                onPress={() => handleSelectSuggestion(item)}
              >
                <Text
                  style={[
                    styles.suggestionName,
                    { color: colors.text },
                  ]}
                >
                  {item.description}
                </Text>
              </Pressable>
            )}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    zIndex: 10,
  },
  inputContainer: {
    minHeight: size.inputHeight,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: spacing.sm,
    fontSize: typography.body,
  },
  clearButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdown: {
    marginTop: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    maxHeight: 240,
    shadowColor: lightColors.shadow,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  suggestionItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  suggestionName: {
    fontSize: 15,
    fontWeight: fontWeight.semibold,
  },
});
