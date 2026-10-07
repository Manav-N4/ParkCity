import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export type Suggestion = {
  name: string;
  latitude: number;
  longitude: number;
};

type SearchBarProps = {
  onSelectSuggestion: (suggestion: Suggestion) => void;
};

const suggestions: Suggestion[] = [
  {
    name: 'Koramangala',
    latitude: 12.9352,
    longitude: 77.6245,
  },
  {
    name: 'Indiranagar',
    latitude: 12.9784,
    longitude: 77.6408,
  },
  {
    name: 'HSR Layout',
    latitude: 12.9116,
    longitude: 77.6474,
  },
  {
    name: 'Kundalahalli',
    latitude: 12.9569,
    longitude: 77.7152,
  },
  {
    name: 'AECS Layout',
    latitude: 12.9698,
    longitude: 77.7161,
  },
];

export default function SearchBar({
  onSelectSuggestion,
}: SearchBarProps) {
  const [searchText, setSearchText] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const filteredSuggestions = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    if (!query) {
      return [];
    }

    return suggestions.filter((suggestion) =>
      suggestion.name.toLowerCase().includes(query)
    );
  }, [searchText]);

  const handleSelectSuggestion = (suggestion: Suggestion) => {
    setSearchText(suggestion.name);
    setIsFocused(false);
    onSelectSuggestion(suggestion);
  };

  const showSuggestions =
    isFocused &&
    searchText.trim().length > 0 &&
    filteredSuggestions.length > 0;

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
          placeholderTextColor="#888888"
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
            data={filteredSuggestions}
            keyExtractor={(item) =>
              `${item.latitude}-${item.longitude}`
            }
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
                    {item.name}
                  </Text>

                  <Text style={styles.suggestionLocation}>
                    Bengaluru
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E2E2',
    borderRadius: 14,
    justifyContent: 'center',
  },

  inputContainerFocused: {
    borderColor: '#111111',
  },

  input: {
    flex: 1,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#111111',
  },

  dropdown: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E8E8',
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
    borderBottomColor: '#F0F0F0',
  },

  suggestionItemPressed: {
    backgroundColor: '#F5F5F5',
  },

  suggestionContent: {
    gap: 3,
  },

  suggestionName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
  },

  suggestionLocation: {
    fontSize: 13,
    color: '#777777',
  },
});