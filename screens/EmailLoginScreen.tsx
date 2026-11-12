
import { useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

import { useTheme } from '../contexts/ThemeContext';
import { spacing, radius, typography, fontWeight } from '../constants/tokens';
import { supabase } from '../lib/supabase';
import type { RootStackParamList } from '../App';

WebBrowser.maybeCompleteAuthSession();

type Props = NativeStackScreenProps<RootStackParamList, 'EmailLogin'>;

export default function EmailLoginScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);

  async function signInWithGoogle() {
    if (loading) return;

    setLoading(true);

    try {
      const redirectTo = Linking.createURL('auth/callback');

      console.log('OAuth Redirect URL:', redirectTo);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        Alert.alert('Google sign-in failed', error.message);
        return;
      }

      if (!data.url) {
        Alert.alert('Something went wrong', 'Could not start Google sign-in.');
        return;
      }

      console.log('OAuth Start URL:', data.url);

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo,
      );

      console.log('OAuth Result:', result);

      if (result.type !== 'success' || !result.url) {
        return;
      }

      const parsedUrl = Linking.parse(result.url);
      const code = parsedUrl.queryParams?.code;

      if (typeof code !== 'string') {
        Alert.alert(
          'Sign-in incomplete',
          'Could not retrieve your Google authentication code. Please try again.',
        );
        return;
      }

      const { error: sessionError } =
        await supabase.auth.exchangeCodeForSession(code);

      if (sessionError) {
        Alert.alert('Sign-in failed', sessionError.message);
        return;
      }

      const next = route.params?.next;

      if (next?.screen === 'ClaimSpot') {
        navigation.reset({
          index: 1,
          routes: [
            { name: 'MainTabs' },
            {
              name: 'ClaimSpot',
              params: { spot: next.spot },
            },
          ],
        });
      } else if (next?.screen === 'ParkingDetails') {
        navigation.reset({
          index: 1,
          routes: [
            { name: 'MainTabs' },
            {
              name: 'ParkingDetails',
              params: { spot: next.spot },
            },
          ],
        });
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: 'MainTabs' }],
        });
      }
    } catch (error) {
      Alert.alert(
        'Something went wrong',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background },
      ]}
    >
      <Pressable
        onPress={() => navigation.goBack()}
        style={styles.back}
      >
        <Text style={[styles.backText, { color: colors.text }]}>
          ← Back
        </Text>
      </Pressable>

      <View style={styles.content}>
        <View style={styles.heading}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>
            PARKCITY
          </Text>

          <Text style={[styles.title, { color: colors.text }]}>
            Welcome to ParkCity.
          </Text>

          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Sign in to find parking, save your favourites, and manage your spots.
          </Text>
        </View>

        <Pressable
          onPress={signInWithGoogle}
          disabled={loading}
          style={({ pressed }) => [
            styles.googleButton,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: loading ? 0.6 : pressed ? 0.75 : 1,
            },
          ]}
        >
          <Text style={styles.googleG}>G</Text>

          <Text style={[styles.googleButtonText, { color: colors.text }]}>
            {loading ? 'Connecting...' : 'Continue with Google'}
          </Text>
        </Pressable>

        <Text style={[styles.note, { color: colors.textSecondary }]}>
          By continuing, you agree to ParkCity’s terms and privacy policy.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  back: {
    position: 'absolute',
    top: 60,
    left: spacing.lg,
    paddingVertical: spacing.sm,
    zIndex: 1,
  },
  backText: {
    fontSize: typography.body,
    fontWeight: fontWeight.medium,
  },
  heading: {
    marginBottom: spacing.xl,
  },
  eyebrow: {
    fontSize: typography.small,
    fontWeight: fontWeight.bold,
    letterSpacing: 2,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 32,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  googleButton: {
    height: 52,
    borderWidth: 1,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  googleG: {
    fontSize: 21,
    fontWeight: fontWeight.bold,
    color: '#4285F4',
  },
  googleButtonText: {
    fontSize: typography.body,
    fontWeight: fontWeight.semibold,
  },
  note: {
    fontSize: typography.small,
    lineHeight: typography.smallLineHeight,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
