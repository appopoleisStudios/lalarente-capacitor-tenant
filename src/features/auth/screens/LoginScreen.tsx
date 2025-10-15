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

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      router.replace('/(owner)/dashboard');
    }, 1200);
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
            <Text style={styles.formTitle}>Let's sign you in</Text>
            <Text style={styles.formSubtitle}>Welcome back, you've been missed</Text>

            {/* Email Input */}
            <Animated.View 
              entering={FadeInDown.delay(400).duration(600)}
              style={styles.inputWrapper}
            >
              <Text style={styles.inputLabel}>Email</Text>
              <View style={styles.inputContainer}>
                <Text style={styles.inputIcon}>✉️</Text>
                <TextInput
                  placeholder="name@company.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  placeholderTextColor={RSA_COLORS.textGray}
                  style={styles.input}
                />
              </View>
            </Animated.View>

            {/* Password Input */}
            <Animated.View 
              entering={FadeInDown.delay(500).duration(600)}
              style={styles.inputWrapper}
            >
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>Password</Text>
                <Pressable>
                  <Text style={styles.forgotLink}>Forgot?</Text>
                </Pressable>
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.inputIcon}>🔒</Text>
                <TextInput
                  placeholder="Enter your password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  placeholderTextColor={RSA_COLORS.textGray}
                  style={styles.input}
                />
                <Pressable
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text style={styles.eyeIcon}>{showPassword ? '👁' : '👁‍🗨'}</Text>
                </Pressable>
              </View>
            </Animated.View>

            {/* Sign In Button */}
            <Animated.View entering={FadeInDown.delay(600).duration(600)}>
              <Pressable
                style={[
                  styles.signInButton,
                  (!email || !password || loading) && styles.signInButtonDisabled,
                ]}
                onPress={handleLogin}
                disabled={!email || !password || loading}
              >
                <Text style={styles.signInButtonText}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </Text>
              </Pressable>
            </Animated.View>

            {/* Divider */}
            <Animated.View 
              entering={FadeInDown.delay(700).duration(600)}
              style={styles.divider}
            >
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </Animated.View>

            {/* Social Buttons */}
            <Animated.View 
              entering={FadeInDown.delay(800).duration(600)}
              style={styles.socialContainer}
            >
              <Pressable style={styles.socialButton}>
                <View style={styles.socialIconContainer}>
                  <Text style={styles.socialIcon}>G</Text>
                </View>
                <Text style={styles.socialText}>Google</Text>
              </Pressable>

              <Pressable style={styles.socialButton}>
                <View style={styles.socialIconContainer}>
                  <Text style={styles.socialIcon}></Text>
                </View>
                <Text style={styles.socialText}>Apple</Text>
              </Pressable>
            </Animated.View>
          </Animated.View>

          {/* Sign Up Link */}
          <Animated.View 
            entering={FadeInDown.delay(900).duration(600)}
            style={styles.signupContainer}
          >
            <Text style={styles.signupText}>Don't have an account? </Text>
            <Pressable>
              <Text style={styles.signupLink}>Sign Up</Text>
            </Pressable>
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
    flexGrow: 1,
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
  // Input styles
  inputWrapper: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: RSA_COLORS.black,
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  forgotLink: {
    fontSize: 14,
    fontWeight: '600',
    color: RSA_COLORS.blue,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: RSA_COLORS.gray,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 54,
  },
  inputIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: RSA_COLORS.black,
    height: '100%',
  },
  eyeButton: {
    padding: 8,
  },
  eyeIcon: {
    fontSize: 18,
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
    backgroundColor: '#CCCCCC',
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: RSA_COLORS.white,
    letterSpacing: 0.3,
  },
  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 32,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E5E5',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 13,
    fontWeight: '500',
    color: RSA_COLORS.textGray,
  },
  // Social buttons
  socialContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    backgroundColor: RSA_COLORS.white,
    borderWidth: 1.5,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    gap: 10,
  },
  socialIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: RSA_COLORS.gray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialIcon: {
    fontSize: 14,
    fontWeight: '700',
    color: RSA_COLORS.black,
  },
  socialText: {
    fontSize: 15,
    fontWeight: '600',
    color: RSA_COLORS.black,
  },
  // Sign up
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  signupText: {
    fontSize: 15,
    color: RSA_COLORS.textGray,
  },
  signupLink: {
    fontSize: 15,
    fontWeight: '700',
    color: RSA_COLORS.green,
  },
});
