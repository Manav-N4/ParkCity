
import { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';

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
import SetReminderScreen from './screens/SetReminderScreen';
import SatisfactionScreen from './screens/SatisfactionScreen';

import FeedbackBubble from './components/FeedbackBubble';

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
  SetReminder: {
    sessionId: string;
    spotName: string;
    accessToken: string;
  };
  Satisfaction: {
    spotId: string;
    sessionId: string;
    isReminder?: boolean;
  };
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

const navigationRef =
  createNavigationContainerRef<RootStackParamList>();

type SatisfactionNotificationData = {
  spot_id?: string;
  session_id?: string;
};

function handleNotificationResponse(
  response: Notifications.NotificationResponse,
) {
  const data = response.notification.request.content
    .data as SatisfactionNotificationData;

  const spotId = data?.spot_id;
  const sessionId = data?.session_id;

  if (
    typeof spotId !== 'string' ||
    typeof sessionId !== 'string' ||
    !spotId ||
    !sessionId
  ) {
    console.warn('Invalid satisfaction notification data:', data);
    return;
  }

  if (navigationRef.isReady()) {
    navigationRef.navigate('Satisfaction', {
      spotId,
      sessionId,
      isReminder: true,
    });
  }
}

export default function App() {
  const pendingNotificationResponse =
    useRef<Notifications.NotificationResponse | null>(null);

  const [currentRouteName, setCurrentRouteName] =
    useState<string | undefined>();

  useEffect(() => {
    // Handle notification taps while the app is already running.
    const subscription =
      Notifications.addNotificationResponseReceivedListener(
        (response) => {
          if (navigationRef.isReady()) {
            handleNotificationResponse(response);
          } else {
            pendingNotificationResponse.current = response;
          }
        },
      );

    // Handle notification taps that launched the app from a closed state.
    const checkInitialNotification = async () => {
      try {
        const response =
          await Notifications.getLastNotificationResponseAsync();

        if (response) {
          if (navigationRef.isReady()) {
            handleNotificationResponse(response);
          } else {
            pendingNotificationResponse.current = response;
          }
        }
      } catch (error) {
        console.error(
          'Could not retrieve the initial notification response:',
          error,
        );
      }
    };

    void checkInitialNotification();

    return () => {
      subscription.remove();
    };
  }, []);

  const handleNavigationReady = () => {
    if (pendingNotificationResponse.current) {
      handleNotificationResponse(
        pendingNotificationResponse.current,
      );

      pendingNotificationResponse.current = null;
    }

    const routeName = navigationRef.getCurrentRoute()?.name;

    setCurrentRouteName(routeName);
  };

  // Track navigation changes to hide the bubble on Satisfaction.
  const handleNavigationStateChange = () => {
    const routeName = navigationRef.getCurrentRoute()?.name;

    setCurrentRouteName(routeName);
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <>
          <NavigationContainer
            ref={navigationRef}
            onReady={handleNavigationReady}
            onStateChange={handleNavigationStateChange}
          >
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
              <Stack.Screen
                name="SetReminder"
                component={SetReminderScreen}
              />
              <Stack.Screen
                name="Satisfaction"
                component={SatisfactionScreen}
                options={{
                  presentation: 'modal',
                  headerShown: false,
                }}
              />
            </Stack.Navigator>
          </NavigationContainer>

          {/* Global floating feedback bubble */}
          <FeedbackBubble
            hidden={currentRouteName === 'Satisfaction'}
          />

          <StatusBar style="auto" />
        </>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
