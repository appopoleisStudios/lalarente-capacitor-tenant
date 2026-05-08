import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../../../lib/supabase';
import { sendMessageToAgent } from '../api/agentApi';
import { colors } from '@/src/shared/theme/colors';
import { spacing } from '@/src/shared/theme/spacing';

type Message = { id: string; role: 'user' | 'agent'; text: string };

const IMAGE_TOKEN_REGEX = /(\[IMG\]\s*https?:\/\/[^\s]+|IMAGE:\s*https?:\/\/[^\s]+)/g;

function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createDotAnimation = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 240,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 240,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.delay(420),
        ])
      );

    const animation = Animated.parallel([
      createDotAnimation(dot1, 0),
      createDotAnimation(dot2, 160),
      createDotAnimation(dot3, 320),
    ]);

    animation.start();

    return () => {
      animation.stop();
    };
  }, [dot1, dot2, dot3]);

  const dots = [dot1, dot2, dot3];

  return (
    <View style={[styles.messageRow, styles.agentRow]}>
      <View style={styles.avatar}>
        <Ionicons name="chatbubble-ellipses" size={16} color={colors.rsa.green} />
      </View>
      <View style={[styles.bubble, styles.agentBubble, styles.typingBubble]}>
        <View style={styles.typingDots}>
          {dots.map((dot, index) => (
            <Animated.View
              key={index}
              style={[
                styles.typingDot,
                {
                  opacity: dot.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.45, 1],
                  }),
                  transform: [
                    {
                      translateY: dot.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -4],
                      }),
                    },
                    {
                      scale: dot.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.1],
                      }),
                    },
                  ],
                },
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

export default function AgentChatScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'agent',
      text: 'Hello. I can help with property details, pricing, locations, and availability.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [tenantId, setTenantId] = useState<string>('unknown');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.id) {
        setTenantId(data.user.id);
      }
    });
  }, []);

  const trimmedInput = useMemo(() => input.trim(), [input]);

  const send = async () => {
    if (!trimmedInput || loading) {
      return;
    }

    const userText = trimmedInput;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: userText };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const reply = await sendMessageToAgent(userText, tenantId);
      setMessages(prev => [...prev, { id: `${Date.now()}-agent`, role: 'agent', text: reply }]);
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: `${Date.now()}-error`,
          role: 'agent',
          text: 'I could not reach the assistant service. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const renderMessageContent = (text: string, isUser: boolean) => {
    const parts = text.split(IMAGE_TOKEN_REGEX);

    return parts.map((part, index) => {
      const trimmedPart = part.trim();

      if (!trimmedPart) {
        return null;
      }

      if (trimmedPart.startsWith('[IMG]') || trimmedPart.startsWith('IMAGE:')) {
        const imageUrl = trimmedPart.replace(/^\[IMG\]\s*|^IMAGE:\s*/g, '').trim();

        return (
          <Image
            key={`${imageUrl}-${index}`}
            source={{ uri: imageUrl }}
            style={styles.propertyImage}
            resizeMode="cover"
          />
        );
      }

      return (
        <Text key={index} style={[styles.messageText, isUser && styles.userMessageText]}>
          {trimmedPart}
        </Text>
      );
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerIconWrap}>
            <Ionicons name="chatbubble-ellipses" size={18} color={colors.background.default} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>Lalarente Assistant</Text>
            <Text style={styles.headerSubtitle}>Property help with live details and images</Text>
          </View>
        </View>

        <FlatList
          data={messages}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isUser = item.role === 'user';

            return (
              <View style={[styles.messageRow, isUser ? styles.userRow : styles.agentRow]}>
                {!isUser ? (
                  <View style={styles.avatar}>
                    <Ionicons name="chatbubble-ellipses" size={16} color={colors.rsa.green} />
                  </View>
                ) : null}
                <View style={[styles.bubble, isUser ? styles.userBubble : styles.agentBubble]}>
                  {renderMessageContent(item.text, isUser)}
                </View>
              </View>
            );
          }}
          ListFooterComponent={loading ? <TypingIndicator /> : null}
        />

        <View style={styles.composerWrap}>
          <View style={styles.composer}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Ask about rent, location, features..."
              placeholderTextColor={colors.text.tertiary}
              onSubmitEditing={send}
              returnKeyType="send"
              multiline
            />
            <TouchableOpacity
              style={[styles.sendButton, !trimmedInput && styles.sendButtonDisabled]}
              onPress={send}
              disabled={!trimmedInput || loading}
            >
              <Ionicons
                name="arrow-up"
                size={18}
                color={trimmedInput ? colors.text.inverse : colors.gray[400]}
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.background.default,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginRight: spacing.sm,
  },
  headerIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.rsa.green,
    marginRight: spacing.sm,
  },
  headerCopy: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: colors.text.secondary,
  },
  chatContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  messageRow: {
    marginBottom: spacing.md,
    maxWidth: '92%',
  },
  agentRow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  userRow: {
    alignSelf: 'flex-end',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.default,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginRight: spacing.sm,
    marginBottom: spacing.xs,
  },
  bubble: {
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  agentBubble: {
    backgroundColor: colors.background.default,
    borderWidth: 1,
    borderColor: colors.border.default,
    minWidth: 140,
  },
  userBubble: {
    backgroundColor: colors.rsa.green,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text.primary,
  },
  userMessageText: {
    color: colors.text.inverse,
  },
  propertyImage: {
    width: 240,
    height: 156,
    borderRadius: 14,
    marginTop: spacing.sm,
  },
  typingBubble: {
    minWidth: 74,
    paddingVertical: spacing.md - 2,
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gray[400],
  },
  composerWrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    backgroundColor: colors.background.default,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: 24,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    paddingVertical: spacing.sm,
  },
  input: {
    flex: 1,
    maxHeight: 110,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text.primary,
    paddingTop: 0,
    paddingBottom: 0,
    marginRight: spacing.sm,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.rsa.green,
  },
  sendButtonDisabled: {
    backgroundColor: colors.gray[200],
  },
});
