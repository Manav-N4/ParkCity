
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from './screens/HomeScreen';
import ParkingDetailsScreen from './screens/ParkingDetailsScreen';
import ClaimSpotScreen from './screens/ClaimSpotScreen';
import EmailLoginScreen from './screens/EmailLoginScreen';
import VerifyOtpScreen from './screens/VerifyOtpScreen';
import ThemeTestScreen from './screens/ThemeTestScreen';

import { ParkingSpot } from './types/parking';
import { ThemeProvider } from './contexts/ThemeContext';

export type RootStackParamList = {
  Home: undefined;

  ParkingDetails: {
    spot: ParkingSpot;
  };

  ClaimSpot: {
    spot: ParkingSpot;
  };

  EmailLogin: {
    next?: {
      screen: 'ClaimSpot';
      spot: ParkingSpot;
    };
  };

  VerifyOtp: {
    phone: string;
    next?: {
      screen: 'ClaimSpot';
      spot: ParkingSpot;
    };
  };

  ThemeTest: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <ThemeProvider>
      <>
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName="Home"
            screenOptions={{
              headerShown: false,
            }}
          >
            <Stack.Screen
              name="Home"
              component={HomeScreen}
            />

            <Stack.Screen
              name="ParkingDetails"
              component={ParkingDetailsScreen}
            />

            <Stack.Screen
              name="ClaimSpot"
              component={ClaimSpotScreen}
            />

            <Stack.Screen
              name="EmailLogin"
              component={EmailLoginScreen}
            />

            <Stack.Screen
              name="VerifyOtp"
              component={VerifyOtpScreen}
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
  );
}
