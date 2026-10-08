import { useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors } from '../constants/tokens';

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

  const showSuggestions =
    isFocused &&
    searchText.trim().length > 0 &&
    suggestions.length > 0;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputContainerFocused,
        ]}
      >
        <TextInput
          style={styles.input}
          placeholder="Search a destination"
          placeholderTextColor={colors.textSecondary}
          value={searchText}
          onChangeText={setSearchText}
          onFocus={() => setIsFocused(true)}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      {showSuggestions && (
        <View style={styles.dropdown}>
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.google_place_id}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [
                  styles.suggestionItem,
                  pressed && styles.suggestionItemPressed,
                ]}
                onPress={() => handleSelectSuggestion(item)}
              >
                <View style={styles.suggestionContent}>
                  <Text style={styles.suggestionName}>
                    {item.description}
                  </Text>
                </View>
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
    height: 52,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    justifyContent: 'center',
  },

  inputContainerFocused: {
    borderColor: colors.text,
  },

  input: {
    flex: 1,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.text,
  },

  dropdown: {
    marginTop: 8,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: 240,

    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },

  suggestionItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  suggestionItemPressed: {
    backgroundColor: colors.background,
  },

  suggestionContent: {
    gap: 3,
  },

  suggestionName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
});