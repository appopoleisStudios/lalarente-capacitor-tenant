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
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  Easing,
  FadeInDown,
  FadeIn,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// South African flag colors
const RSA_COLORS = {
  green: '#007A4D',
  gold: '#FFB81C',
  blue: '#002395',
  red: '#DE3831',
  white: '#FFFFFF',
  black: '#000000',
  gray: '#F5F5F5',
  textGray: '#737373',
};

import { useAuth } from '@/src/contexts/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, profile, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Redirect based on role when profile loads after login
  useEffect(() => {
    if (profile && !authLoading) {
      setLoading(false);
      
      // Role-based navigation
      if (profile.role === 'owner') {
        router.replace('/(owner)/dashboard');
      } else if (profile.role === 'tenant') {
        router.replace('/(tenant)/dashboard');
      } else if (profile.role === 'vendor') {
        router.replace('/(vendor)/dashboard');
      }
    }
  }, [profile, authLoading]);

  // Animations
  const logoScale = useSharedValue(0.8);
  const logoRotate = useSharedValue(0);

  useEffect(() => {
    logoScale.value = withSpring(1, {
      damping: 10,
      stiffness: 100,
    });
    logoRotate.value = withRepeat(
      withTiming(360, {
        duration: 20000,
        easing: Easing.linear,
      }),
      -1
    );
  }, []);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: logoScale.value },
      { rotate: `${logoRotate.value}deg` },
    ],
  }));

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      alert('Please enter both email and password');
      return;
    }

    try {
      setLoading(true);
      await signIn(email.trim(), password);
      
      // Note: Navigation will be handled by useEffect watching profile changes
      // See useEffect below that redirects based on role
    } catch (error: any) {
      console.error('Login error:', error);
      alert(error.message || 'Login failed. Please check your credentials.');
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo Section */}
          <Animated.View 
            entering={FadeIn.duration(800)}
            style={styles.logoSection}
          >
            <Animated.View style={[styles.logoContainer, logoAnimatedStyle]}>
              <View style={styles.logoRing}>
                <View style={styles.logoInner}>
                  <Text style={styles.logoText}>L</Text>
                </View>
              </View>
            </Animated.View>
            <Text style={styles.appName}>Lalarente</Text>
            <Text style={styles.tagline}>Property Management Simplified</Text>
          </Animated.View>

          {/* Form Section */}
          <Animated.View 
            entering={FadeInDown.delay(200).duration(600)}
            style={styles.formContainer}
          >
            <Text style={styles.formTitle}>Welcome Back</Text>
            <Text style={styles.formSubtitle}>Sign in to your account</Text>

            {/* Email Input */}
            <Animated.View entering={FadeInDown.delay(300).duration(600)}>
              <Text style={styles.inputLabel}>Email</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color={RSA_COLORS.textGray} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="your@email.com"
                  placeholderTextColor={RSA_COLORS.textGray}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  editable={!loading}
                />
              </View>
            </Animated.View>

            {/* Password Input */}
            <Animated.View entering={FadeInDown.delay(400).duration(600)}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color={RSA_COLORS.textGray} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor={RSA_COLORS.textGray}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password"
                  editable={!loading}
                />
                <Pressable
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={RSA_COLORS.textGray} />
                </Pressable>
              </View>
            </Animated.View>

            {/* Sign In Button */}
            <Animated.View entering={FadeInDown.delay(500).duration(600)}>
              <Pressable
                style={[
                  styles.signInButton,
                  loading && styles.signInButtonDisabled,
                ]}
                onPress={handleLogin}
                disabled={loading}
              >
                <Text style={styles.signInButtonText}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </Text>
              </Pressable>
            </Animated.View>

            {/* Register Link */}
            <Animated.View entering={FadeInDown.delay(600).duration(600)} style={styles.registerRow}>
              <Text style={styles.registerText}>Don't have an account? </Text>
              <Pressable onPress={() => router.push('/auth/register' as any)}>
                <Text style={styles.registerLink}>Create Account</Text>
              </Pressable>
            </Animated.View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: RSA_COLORS.white,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  // Logo section
  logoSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoContainer: {
    marginBottom: 20,
  },
  logoRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: RSA_COLORS.green,
    borderStyle: 'dashed',
    padding: 8,
  },
  logoInner: {
    flex: 1,
    backgroundColor: RSA_COLORS.green,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 36,
    fontWeight: '800',
    color: RSA_COLORS.white,
  },
  appName: {
    fontSize: 28,
    fontWeight: '700',
    color: RSA_COLORS.black,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    color: RSA_COLORS.textGray,
    marginTop: 4,
  },
  // Form section
  formContainer: {
    marginBottom: 32,
  },
  formTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: RSA_COLORS.black,
    marginBottom: 6,
  },
  formSubtitle: {
    fontSize: 15,
    color: RSA_COLORS.textGray,
    marginBottom: 32,
  },
  // Input fields
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: RSA_COLORS.black,
    marginBottom: 8,
    marginTop: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: RSA_COLORS.white,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 54,
  },
  inputIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: RSA_COLORS.black,
    height: '100%',
  },
  eyeButton: {
    padding: 4,
  },
  eyeIcon: {
    fontSize: 20,
  },
  helperText: {
    fontSize: 13,
    color: RSA_COLORS.textGray,
    textAlign: 'center',
    marginTop: 16,
  },
  // Sign in button
  signInButton: {
    backgroundColor: RSA_COLORS.green,
    height: 54,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  signInButtonDisabled: {
    opacity: 0.5,
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: RSA_COLORS.white,
    letterSpacing: 0.3,
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  registerText: {
    fontSize: 14,
    color: RSA_COLORS.textGray,
  },
  registerLink: {
    fontSize: 14,
    fontWeight: '700',
    color: RSA_COLORS.green,
  },
});
