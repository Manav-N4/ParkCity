
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import HomeScreen from '../screens/HomeScreen';
import SavedScreen from '../screens/SavedScreen';
import ParkingHistoryScreen from '../screens/ParkingHistoryScreen';
import ProfileScreen from '../screens/ProfileScreen';

import { useTheme } from '../contexts/ThemeContext';
import {
  fontWeight,
  letterSpacing,
  shadow,
  size,
  spacing,
} from '../constants/tokens';

export type MainTabParamList = {
  Home: undefined;
  Saved: undefined;
  History: undefined;
  Profile: undefined;
};

type IoniconName = keyof typeof Ionicons.glyphMap;

// [focused, unfocused] icon for each tab.
const TAB_ICONS: Record<
  keyof MainTabParamList,
  [IoniconName, IoniconName]
> = {
  Home: ['home', 'home-outline'],
  Saved: ['heart', 'heart-outline'],
  History: ['time', 'time-outline'],
  Profile: ['person', 'person-outline'],
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // Keep labels clear of the Android gesture bar / iOS home indicator.
  const bottomPadding = Math.max(insets.bottom, spacing.sm);

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primaryDeep,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: size.tabBarHeight + bottomPadding,
          paddingTop: spacing.sm,
          paddingBottom: bottomPadding,
          ...shadow.md,
          shadowOffset: { width: 0, height: -2 },
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: fontWeight.semibold,
          letterSpacing: letterSpacing.wide,
        },
        tabBarIcon: ({ color, focused }) => {
          const [focusedIcon, unfocusedIcon] = TAB_ICONS[route.name];

          return (
            <Ionicons
              name={focused ? focusedIcon : unfocusedIcon}
              size={size.iconLarge - 2}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: 'Explore' }}
      />

      <Tab.Screen
        name="Saved"
        component={SavedScreen}
        options={{ tabBarLabel: 'Saved' }}
      />

      <Tab.Screen
        name="History"
        component={ParkingHistoryScreen}
        options={{ tabBarLabel: 'History' }}
      />

      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
  );
}
