
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

import MainTabNavigator from './navigation/MainTabNavigator';

import WelcomeScreen from './screens/WelcomeScreen';
import ParkingDetailsScreen from './screens/ParkingDetailsScreen';
import ActiveParkingScreen from './screens/ActiveParkingScreen';
import ClaimSpotScreen from './screens/ClaimSpotScreen';
import EmailLoginScreen from './screens/EmailLoginScreen';
import MyListingsScreen from './screens/MyListingsScreen';
import ThemeTestScreen from './screens/ThemeTestScreen';
import ReportIssueScreen from './screens/ReportIssueScreen';
import SetReminderScreen from './screens/SetReminderScreen';
import SatisfactionScreen from './screens/SatisfactionScreen';
import AdminPaymentScreen from './screens/AdminPaymentScreen';
import SettingsScreen from './screens/SettingsScreen';
import LegalScreen from './screens/LegalScreen';
import CreateListingScreen from './screens/CreateListingScreen';
import ConsentScreen from './screens/ConsentScreen';

import FeedbackBubble from './components/FeedbackBubble';

import { ThemeProvider } from './contexts/ThemeContext';
import { DialogProvider } from './contexts/DialogContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';

import { colors } from './constants/tokens';

import type { ParkingSpot } from './types/parking';
import type { ParkingHistoryItem } from './lib/api';

export type RootStackParamList = {
  Welcome: undefined;
  MainTabs: undefined;
  ParkingDetails: { spot: ParkingSpot };
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
  AdminPayments: undefined;
  Settings: undefined;
  Legal: undefined;
  SpotDetail: { spotId: string };
  CreateListing: undefined;
  Consent: undefined;
};

type PostLoginDestination = NonNullable<
  RootStackParamList['EmailLogin']['next']
>;

const PENDING_DESTINATION_KEY = 'pending_post_login_destination';
const CONSENT_KEY = 'consent_given';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navigationRef =
  createNavigationContainerRef<RootStackParamList>();

type SatisfactionNotificationData = {
  spot_id?: string;
  session_id?: string;
};

function isPostLoginDestination(
  value: unknown,
): value is PostLoginDestination {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const destination = value as {
    screen?: unknown;
    spot?: unknown;
  };

  return (
    (destination.screen === 'ClaimSpot' ||
      destination.screen === 'ParkingDetails') &&
    typeof destination.spot === 'object' &&
    destination.spot !== null
  );
}

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

function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

function AppNavigator() {
  const { session, loading } = useAuth();

  const pendingNotificationResponse =
    useRef<Notifications.NotificationResponse | null>(null);

  const [currentRouteName, setCurrentRouteName] =
    useState<string | undefined>();

  const [navigationReady, setNavigationReady] = useState(false);

  const [consentGiven, setConsentGiven] =
    useState<boolean | null>(null);

  const userId = session?.user.id;

  // Check consent after the authentication session is available.
  useEffect(() => {
    let mounted = true;

    const checkConsent = async () => {
      if (!userId) {
        if (mounted) {
          setConsentGiven(false);
        }
        return;
      }

      try {
        const value = await AsyncStorage.getItem(CONSENT_KEY);

        if (mounted) {
          setConsentGiven(value === 'true');
        }
      } catch (error) {
        console.error('Could not check consent:', error);

        if (mounted) {
          setConsentGiven(false);
        }
      }
    };

    setConsentGiven(null);
    void checkConsent();

    return () => {
      mounted = false;
    };
  }, [userId]);

  // Process a notification only after authentication and consent.
  const processPendingNotification = useCallback(() => {
    if (
      !session ||
      !consentGiven ||
      !navigationRef.isReady() ||
      !pendingNotificationResponse.current
    ) {
      return;
    }

    handleNotificationResponse(
      pendingNotificationResponse.current,
    );

    pendingNotificationResponse.current = null;
  }, [session, consentGiven]);

  useEffect(() => {
    processPendingNotification();
  }, [processPendingNotification]);

  // Restore a destination requested before login.
  useEffect(() => {
    if (
      !session ||
      !consentGiven ||
      !navigationReady ||
      !navigationRef.isReady()
    ) {
      return;
    }

    let cancelled = false;

    const restoreDestination = async () => {
      try {
        const storedDestination = await AsyncStorage.getItem(
          PENDING_DESTINATION_KEY,
        );

        if (!storedDestination || cancelled) {
          return;
        }

        const parsedDestination: unknown = JSON.parse(storedDestination);

        if (!isPostLoginDestination(parsedDestination)) {
          await AsyncStorage.removeItem(PENDING_DESTINATION_KEY);
          return;
        }

        // Remove it before navigating to avoid restoring it again.
        await AsyncStorage.removeItem(PENDING_DESTINATION_KEY);

        if (cancelled || !navigationRef.isReady()) {
          return;
        }

        if (parsedDestination.screen === 'ClaimSpot') {
          navigationRef.navigate('ClaimSpot', {
            spot: parsedDestination.spot,
          });
        } else {
          navigationRef.navigate('ParkingDetails', {
            spot: parsedDestination.spot,
          });
        }
      } catch (error) {
        console.error('Could not restore post-login destination:', error);
      }
    };

    void restoreDestination();

    return () => {
      cancelled = true;
    };
  }, [session, consentGiven, navigationReady]);

  // Listen for notification taps.
  useEffect(() => {
    const subscription =
      Notifications.addNotificationResponseReceivedListener(
        (response) => {
          if (
            session &&
            consentGiven &&
            navigationRef.isReady()
          ) {
            handleNotificationResponse(response);
          } else {
            pendingNotificationResponse.current = response;
          }
        },
      );

    // Handle notifications that launched the app.
    const checkInitialNotification = async () => {
      try {
        const response =
          await Notifications.getLastNotificationResponseAsync();

        if (response) {
          if (
            session &&
            consentGiven &&
            navigationRef.isReady()
          ) {
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
  }, [session, consentGiven]);

  const handleNavigationReady = () => {
    setNavigationReady(true);

    const routeName = navigationRef.getCurrentRoute()?.name;
    setCurrentRouteName(routeName);

    processPendingNotification();
  };

  const handleNavigationStateChange = () => {
    const routeName = navigationRef.getCurrentRoute()?.name;
    setCurrentRouteName(routeName);

    // Refresh consent after ConsentScreen saves it.
    // This also works when consent navigates directly to a pending destination.
    if (routeName && session && !consentGiven) {
      AsyncStorage.getItem(CONSENT_KEY)
        .then((value) => {
          if (value === 'true') {
            setConsentGiven(true);
          }
        })
        .catch((error) => {
          console.error('Could not refresh consent status:', error);
        });
    }
  };

  if (loading || (session && consentGiven === null)) {
    return <LoadingScreen />;
  }

  return (
    <>
      <NavigationContainer
        ref={navigationRef}
        onReady={handleNavigationReady}
        onStateChange={handleNavigationStateChange}
      >
        <Stack.Navigator
          key={session ? 'authenticated' : 'unauthenticated'}
          initialRouteName={
            session
              ? consentGiven
                ? 'MainTabs'
                : 'Consent'
              : 'Welcome'
          }
          screenOptions={{ headerShown: false }}
        >
          {!session ? (
            <>
              {/* Logged-out users can only access these screens. */}
              <Stack.Screen
                name="Welcome"
                component={WelcomeScreen}
              />

              <Stack.Screen
                name="EmailLogin"
                component={EmailLoginScreen}
              />
            </>
          ) : (
            <>
              {/* Authenticated app screens. */}
              <Stack.Screen
                name="MainTabs"
                component={MainTabNavigator}
              />

              <Stack.Screen
                name="ParkingDetails"
                component={ParkingDetailsScreen}
              />

              <Stack.Screen
                name="ActiveParking"
                component={ActiveParkingScreen}
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

              <Stack.Screen
                name="AdminPayments"
                component={AdminPaymentScreen}
              />

              <Stack.Screen
                name="Settings"
                component={SettingsScreen}
              />

              <Stack.Screen
                name="Legal"
                component={LegalScreen}
              />

              <Stack.Screen
                name="CreateListing"
                component={CreateListingScreen}
              />

              <Stack.Screen
                name="Consent"
                component={ConsentScreen}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>

      {/* Show the feedback bubble only for authenticated users. */}
      {session && (
        <FeedbackBubble
          hidden={
            currentRouteName === 'Satisfaction' ||
            currentRouteName === 'ParkingDetails' ||
            currentRouteName === 'ActiveParking' ||
            currentRouteName === 'SetReminder' ||
            currentRouteName === 'ReportIssue' ||
            currentRouteName === 'ClaimSpot'
          }
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <DialogProvider>
          <AuthProvider>
            <AppNavigator />
            <StatusBar style="auto" />
          </AuthProvider>
        </DialogProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
