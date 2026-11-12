
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import MainTabNavigator from './navigation/MainTabNavigator';

import ParkingDetailsScreen from './screens/ParkingDetailsScreen';
import ParkingHistoryScreen from './screens/ParkingHistoryScreen';
import ActiveParkingScreen from './screens/ActiveParkingScreen';
import ProfileScreen from './screens/ProfileScreen';
import ClaimSpotScreen from './screens/ClaimSpotScreen';
import EmailLoginScreen from './screens/EmailLoginScreen';
import MyListingsScreen from './screens/MyListingsScreen';
import ThemeTestScreen from './screens/ThemeTestScreen';
import ReportIssueScreen from './screens/ReportIssueScreen';

import type { ParkingSpot } from './types/parking';
import type { ParkingHistoryItem } from './lib/api';
import { ThemeProvider } from './contexts/ThemeContext';

export type RootStackParamList = {
  MainTabs: undefined;
  ParkingDetails: { spot: ParkingSpot };
  ParkingHistory: undefined;
  ActiveParking: {
    session: ParkingHistoryItem;
  };
  Profile: undefined;
  ClaimSpot: { spot: ParkingSpot };
  ReportIssue: { spot: ParkingSpot };
  EmailLogin: {
    next?:
      | {
          screen: 'ClaimSpot';
          spot: ParkingSpot;
        }
      | {
          screen: 'ParkingDetails';
          spot: ParkingSpot;
        };
  };
  MyListings: undefined;
  ThemeTest: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <>
          <NavigationContainer>
            <Stack.Navigator
              initialRouteName="MainTabs"
              screenOptions={{ headerShown: false }}
            >
              <Stack.Screen
                name="MainTabs"
                component={MainTabNavigator}
              />
              <Stack.Screen
                name="ParkingDetails"
                component={ParkingDetailsScreen}
              />
              <Stack.Screen
                name="ParkingHistory"
                component={ParkingHistoryScreen}
              />
              <Stack.Screen
                name="ActiveParking"
                component={ActiveParkingScreen}
              />
              <Stack.Screen
                name="Profile"
                component={ProfileScreen}
              />
              <Stack.Screen
                name="ClaimSpot"
                component={ClaimSpotScreen}
              />
              <Stack.Screen
                name="ReportIssue"
                component={ReportIssueScreen}
              />
              <Stack.Screen
                name="EmailLogin"
                component={EmailLoginScreen}
              />
              <Stack.Screen
                name="MyListings"
                component={MyListingsScreen}
              />
              <Stack.Screen
                name="ThemeTest"
                component={ThemeTestScreen}
              />
            </Stack.Navigator>
          </NavigationContainer>

          <StatusBar style="auto" />
        </>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
