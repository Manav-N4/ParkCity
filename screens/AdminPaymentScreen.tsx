
import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Clipboard,
  ActivityIndicator,
  ScrollView,
} from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../App'
import { useTheme } from '../contexts/ThemeContext'
import { useDialog } from '../contexts/DialogContext'
import { API_BASE_URL } from '../lib/api'
import { supabase } from '../lib/supabase'
import { spacing, fontWeight } from '../constants/tokens'

type Props = NativeStackScreenProps<RootStackParamList, 'AdminPayments'>

export default function AdminPaymentScreen({ navigation }: Props) {
  const { colors } = useTheme()
  const { showDialog } = useDialog()

  const [merchantId, setMerchantId] = useState('')
  const [spotId, setSpotId] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentLink, setPaymentLink] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const generateLink = async () => {
    if (!merchantId || !spotId || !amount) {
      showDialog({
        type: 'warning',
        title: 'Error',
        message: 'All fields are required',
      })
      return
    }

    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${API_BASE_URL}/payments/create-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          merchant_id: merchantId,
          spot_id: spotId,
          amount: parseFloat(amount),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPaymentLink(data.payment_link)
    } catch (e) {
      showDialog({
        type: 'error',
        title: 'Error',
        message: e instanceof Error ? e.message : 'Something went wrong',
      })
    } finally {
      setLoading(false)
    }
  }

  const copyLink = () => {
    if (!paymentLink) return
    Clipboard.setString(paymentLink)
    showDialog({
      type: 'success',
      title: 'Copied',
      message: 'Payment link copied to clipboard',
    })
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
      </TouchableOpacity>

      <Text style={[styles.title, { color: colors.text }]}>
        Merchant Payment Link
      </Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Generate a Razorpay payment link for a merchant.
      </Text>

      <View style={styles.form}>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
          placeholder="Merchant User ID"
          placeholderTextColor={colors.textSecondary}
          value={merchantId}
          onChangeText={setMerchantId}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
          placeholder="Spot ID"
          placeholderTextColor={colors.textSecondary}
          value={spotId}
          onChangeText={setSpotId}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
          placeholder="Amount (₹)"
          placeholderTextColor={colors.textSecondary}
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
        />

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }, loading && { opacity: 0.7 }]}
          onPress={generateLink}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>Generate Link</Text>
          }
        </TouchableOpacity>
      </View>

      {paymentLink && (
        <View style={[styles.linkBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Text style={[styles.linkLabel, { color: colors.textSecondary }]}>Payment Link</Text>
          <Text style={[styles.linkText, { color: colors.text }]} selectable>
            {paymentLink}
          </Text>
          <TouchableOpacity onPress={copyLink} activeOpacity={0.7}>
            <Text style={[styles.copyBtn, { color: colors.primary }]}>Copy Link</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingTop: 60,
    paddingBottom: 40,
  },
  backButton: {
    marginBottom: spacing.lg,
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: 16,
    fontWeight: fontWeight.semibold,
  },
  title: {
    fontSize: 24,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    marginBottom: spacing.xl,
  },
  form: {
    gap: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
  },
  button: {
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonText: {
    color: '#fff',
    fontWeight: fontWeight.bold,
    fontSize: 15,
  },
  linkBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.xl,
    gap: 8,
  },
  linkLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  linkText: {
    fontSize: 13,
    lineHeight: 20,
  },
  copyBtn: {
    fontSize: 14,
    fontWeight: fontWeight.semibold,
  },
})
