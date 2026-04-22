import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/contexts/AuthContext';

const RSA = {
  green: '#007A4D',
  gold: '#FFB81C',
  blue: '#002395',
  white: '#FFFFFF',
  black: '#000000',
  gray: '#F5F5F5',
  textGray: '#737373',
  border: '#E5E5E5',
  error: '#DC2626',
};

type Role = 'owner' | 'tenant';

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp, profile, loading: authLoading } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<Role>('tenant');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  // Navigate after profile is set
  useEffect(() => {
    if (profile && !authLoading) {
      if (profile.role === 'owner') {
        router.replace('/(owner)/dashboard');
      } else if (profile.role === 'tenant') {
        router.replace('/(tenant)/dashboard');
      }
    }
  }, [profile, authLoading]);

  const handleRegister = async () => {
    if (!fullName.trim() || fullName.trim().length < 2) {
      Alert.alert('Required', 'Please enter your full name');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email.trim())) {
      Alert.alert('Invalid', 'Please enter a valid email address');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Invalid', 'Password must be at least 8 characters');
      return;
    }
    if (!/[0-9!@#$%^&*()_+\-=\[\]{}|;':",.<>?/`~]/.test(password)) {
      Alert.alert('Invalid', 'Password must contain at least one number or special character');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match');
      return;
    }

    try {
      setLoading(true);
      await signUp(email.trim(), password, fullName.trim(), role);
      // navigation handled by useEffect above
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message || 'Could not create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <Animated.View entering={FadeIn.duration(600)} style={styles.header}>
            <View style={styles.logoRing}>
              <View style={styles.logoInner}>
                <Text style={styles.logoText}>L</Text>
              </View>
            </View>
            <Text style={styles.appName}>Lalarente</Text>
            <Text style={styles.tagline}>Create your account</Text>
          </Animated.View>

          {/* Form */}
          <Animated.View entering={FadeInDown.delay(150).duration(500)} style={styles.form}>
            <Text style={styles.formTitle}>Get Started</Text>
            <Text style={styles.formSub}>Fill in your details below</Text>

            {/* Role selector */}
            <Text style={styles.label}>I am a</Text>
            <View style={styles.roleRow}>
              {(['tenant', 'owner'] as Role[]).map(r => (
                <Pressable
                  key={r}
                  style={[styles.roleBtn, role === r && styles.roleBtnActive]}
                  onPress={() => setRole(r)}
                >
                  <Text style={[styles.roleBtnText, role === r && styles.roleBtnTextActive]}>
                    {r === 'tenant' ? 'Tenant' : 'Owner'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Full Name */}
            <Animated.View entering={FadeInDown.delay(200).duration(500)}>
              <Text style={styles.label}>Full Name</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color={RSA.textGray} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Your full name"
                  placeholderTextColor={RSA.textGray}
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                  editable={!loading}
                />
              </View>
            </Animated.View>

            {/* Email */}
            <Animated.View entering={FadeInDown.delay(250).duration(500)}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color={RSA.textGray} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="your@email.com"
                  placeholderTextColor={RSA.textGray}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  editable={!loading}
                />
              </View>
            </Animated.View>

            {/* Password */}
            <Animated.View entering={FadeInDown.delay(300).duration(500)}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color={RSA.textGray} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Min. 8 chars + number or symbol"
                  placeholderTextColor={RSA.textGray}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  editable={!loading}
                />
                <Pressable onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={RSA.textGray} />
                </Pressable>
              </View>
            </Animated.View>

            {/* Confirm Password */}
            <Animated.View entering={FadeInDown.delay(350).duration(500)}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color={RSA.textGray} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Repeat your password"
                  placeholderTextColor={RSA.textGray}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirm}
                  autoCapitalize="none"
                  editable={!loading}
                />
                <Pressable onPress={() => setShowConfirm(v => !v)} style={styles.eyeBtn}>
                  <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color={RSA.textGray} />
                </Pressable>
              </View>
            </Animated.View>

            {/* Submit */}
            <Animated.View entering={FadeInDown.delay(400).duration(500)}>
              <Pressable
                style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                onPress={handleRegister}
                disabled={loading}
              >
                <Text style={styles.submitBtnText}>
                  {loading ? 'Creating Account…' : 'Create Account'}
                </Text>
              </Pressable>
            </Animated.View>

            {/* Link back to login */}
            <Animated.View entering={FadeInDown.delay(450).duration(500)} style={styles.loginLink}>
              <Text style={styles.loginLinkText}>Already have an account? </Text>
              <Pressable onPress={() => router.replace('/auth/login')}>
                <Text style={styles.loginLinkAction}>Sign In</Text>
              </Pressable>
            </Animated.View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: RSA.white },
  scrollContent: { paddingHorizontal: 24, paddingTop: 52, paddingBottom: 40 },

  header: { alignItems: 'center', marginBottom: 36 },
  logoRing: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 2, borderColor: RSA.green,
    borderStyle: 'dashed', padding: 6, marginBottom: 14,
  },
  logoInner: {
    flex: 1, backgroundColor: RSA.green,
    borderRadius: 34, alignItems: 'center', justifyContent: 'center',
  },
  logoText: { fontSize: 28, fontWeight: '800', color: RSA.white },
  appName: { fontSize: 24, fontWeight: '700', color: RSA.black },
  tagline: { fontSize: 13, color: RSA.textGray, marginTop: 2 },

  form: { marginBottom: 24 },
  formTitle: { fontSize: 24, fontWeight: '700', color: RSA.black, marginBottom: 4 },
  formSub: { fontSize: 14, color: RSA.textGray, marginBottom: 24 },

  label: {
    fontSize: 14, fontWeight: '600', color: RSA.black,
    marginBottom: 8, marginTop: 16,
  },

  roleRow: { flexDirection: 'row', gap: 12 },
  roleBtn: {
    flex: 1, height: 48, borderRadius: 10,
    borderWidth: 2, borderColor: RSA.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: RSA.gray,
  },
  roleBtnActive: { borderColor: RSA.green, backgroundColor: '#E6F7F1' },
  roleBtnText: { fontSize: 14, fontWeight: '600', color: RSA.textGray },
  roleBtnTextActive: { color: RSA.green },

  inputContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: RSA.white, borderWidth: 2, borderColor: RSA.border,
    borderRadius: 12, paddingHorizontal: 14, height: 52,
  },
  inputIcon: { fontSize: 18, marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: RSA.black, height: '100%' },
  eyeBtn: { padding: 4 },
  eyeIcon: { fontSize: 18 },

  submitBtn: {
    backgroundColor: RSA.green, height: 52,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 28,
  },
  submitBtnDisabled: { opacity: 0.55 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: RSA.white },

  loginLink: { flexDirection: 'row', justifyContent: 'center', marginTop: 18 },
  loginLinkText: { fontSize: 14, color: RSA.textGray },
  loginLinkAction: { fontSize: 14, fontWeight: '700', color: RSA.green },
});
