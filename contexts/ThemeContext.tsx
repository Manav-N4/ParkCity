
import React, {
  createContext,
  useContext,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import { colors, darkColors } from '../constants/tokens';

type ThemeContextValue = {
  colors: typeof colors;
  isDark: boolean;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  colors,
  isDark: false,
  toggleTheme: () => {},
});

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const scheme = useColorScheme();
  const [themeOverride, setThemeOverride] = useState<boolean | null>(null);

  const isDark = themeOverride ?? scheme === 'dark';

  const toggleTheme = () => {
    setThemeOverride(!isDark);
  };

  return (
    <ThemeContext.Provider
      value={{
        colors: isDark ? darkColors : colors,
        isDark,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
