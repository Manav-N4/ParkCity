
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from './screens/HomeScreen';
import ParkingDetailsScreen from './screens/ParkingDetailsScreen';

export type RootStackParamList = {
  Home: undefined;
  ParkingDetails: {
    spot: {
      google_place_id: string;
      name: string;
      lat: number;
      lng: number;
      price_per_hour: number | null;
      source: string;
    };
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen
            name="ParkingDetails"
            component={ParkingDetailsScreen}
          />
        </Stack.Navigator>
      </NavigationContainer>

      <StatusBar style="dark" />
    </>
  );
}
