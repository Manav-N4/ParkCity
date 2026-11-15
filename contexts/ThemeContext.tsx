
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
} from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, darkColors } from '../constants/tokens';

const THEME_KEY = 'theme_preference';

type ThemePreference = 'light' | 'dark' | 'system';

type ThemeContextValue = {
  colors: typeof colors;
  isDark: boolean;
  theme: ThemePreference;
  toggleTheme: () => void;
  setTheme: (theme: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  colors,
  isDark: false,
  theme: 'system',
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const scheme = useColorScheme();
  const [theme, setThemeState] = useState<ThemePreference>('system');

  // Load persisted preference on mount
  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY)
      .then((saved) => {
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          setThemeState(saved);
        }
      })
      .catch(() => {});
  }, []);

  const isDark =
    theme === 'dark' || (theme === 'system' && scheme === 'dark');

  const toggleTheme = () => {
    const next: ThemePreference = isDark ? 'light' : 'dark';
    setThemeState(next);
    AsyncStorage.setItem(THEME_KEY, next).catch((e) => {
      console.warn('Could not save theme preference', e);
    });
  };

  const setThemePreference = async (next: ThemePreference) => {
    setThemeState(next);
    try {
      await AsyncStorage.setItem(THEME_KEY, next);
    } catch (e) {
      console.warn('Could not save theme preference', e);
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        colors: isDark ? darkColors : colors,
        isDark,
        theme,
        toggleTheme,
        setTheme: setThemePreference,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
