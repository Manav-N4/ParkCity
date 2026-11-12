
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import type { RootStackParamList } from '../App';

import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { spacing, fontWeight } from '../constants/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export default function ProfileScreen({ navigation }: Props) {
  const { colors } = useTheme();

  const [name, setName] = useState('ParkCity User');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);

    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) throw error;

      if (user) {
        setEmail(user.email ?? '');

        const metadata = user.user_metadata ?? {};

        setName(
          metadata.full_name ||
            metadata.name ||
            metadata.display_name ||
            user.email?.split('@')[0] ||
            'ParkCity User',
        );
      } else {
        setName('Guest User');
        setEmail('');
      }
    } catch (error) {
      console.error('Could not load profile:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  const handleSignOut = () => {
    Alert.alert(
      'Sign out',
      'Are you sure you want to sign out of ParkCity?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            setSigningOut(true);

            try {
              const { error } = await supabase.auth.signOut();

              if (error) throw error;

              setName('Guest User');
              setEmail('');
            } catch (error) {
              Alert.alert(
                'Sign out failed',
                error instanceof Error ? error.message : 'Please try again.',
              );
            } finally {
              setSigningOut(false);
            }
          },
        },
      ],
    );
  };

  const openHistory = () => {
    navigation.navigate('ParkingHistory');
  };

  const openListings = () => {
    navigation.navigate('MyListings');
  };

  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>
          Profile
        </Text>

        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Manage your ParkCity account.
        </Text>
      </View>

      <View
        style={[
          styles.profileCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.avatarText}>{initials || 'P'}</Text>
          )}
        </View>

        <View style={styles.profileInfo}>
          <Text style={[styles.name, { color: colors.text }]}>
            {loading ? 'Loading profile...' : name}
          </Text>

          <Text style={[styles.email, { color: colors.textSecondary }]}>
            {email || 'Not signed in'}
          </Text>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Your activity
      </Text>

      <View
        style={[
          styles.menuCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <Pressable style={styles.menuItem} onPress={openHistory}>
          <View
            style={[
              styles.menuIcon,
              { backgroundColor: colors.primary + '18' },
            ]}
          >
            <Ionicons
              name="time-outline"
              size={22}
              color={colors.primary}
            />
          </View>

          <View style={styles.menuInfo}>
            <Text style={[styles.menuTitle, { color: colors.text }]}>
              Parking History
            </Text>

            <Text
              style={[
                styles.menuSubtitle,
                { color: colors.textSecondary },
              ]}
            >
              View your previous parking sessions
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.textSecondary}
          />
        </Pressable>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <Pressable style={styles.menuItem} onPress={openListings}>
          <View
            style={[
              styles.menuIcon,
              { backgroundColor: colors.primary + '18' },
            ]}
          >
            <Ionicons
              name="car-outline"
              size={22}
              color={colors.primary}
            />
          </View>

          <View style={styles.menuInfo}>
            <Text style={[styles.menuTitle, { color: colors.text }]}>
              My Listings
            </Text>

            <Text
              style={[
                styles.menuSubtitle,
                { color: colors.textSecondary },
              ]}
            >
              Manage your parking listings
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.textSecondary}
          />
        </Pressable>
      </View>

      <Pressable
        onPress={handleSignOut}
        disabled={signingOut || loading || !email}
        style={[
          styles.signOutButton,
          { borderColor: colors.error },
          (signingOut || loading || !email) && { opacity: 0.5 },
        ]}
      >
        {signingOut ? (
          <ActivityIndicator color={colors.error} />
        ) : (
          <>
            <Ionicons
              name="log-out-outline"
              size={20}
              color={colors.error}
            />

            <Text style={[styles.signOutText, { color: colors.error }]}>
              Sign out
            </Text>
          </>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: 60,
    paddingBottom: spacing.xl,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: fontWeight.bold,
  },
  subtitle: {
    marginTop: spacing.xs,
    fontSize: 14,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: 18,
    borderWidth: 1,
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: fontWeight.bold,
  },
  profileInfo: {
    flex: 1,
    gap: 5,
  },
  name: {
    fontSize: 17,
    fontWeight: fontWeight.semibold,
  },
  email: {
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.md,
  },
  menuCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xl,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuInfo: {
    flex: 1,
    gap: 4,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: fontWeight.semibold,
  },
  menuSubtitle: {
    fontSize: 12,
  },
  divider: {
    height: 1,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: 13,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: fontWeight.semibold,
  },
});
