import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Image,
  Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAvoidingView } from '@/src/shared/components/layouts/KeyboardAvoidingView';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { messagesApi } from '../api/messagesApi';
import { ThreadWithRelations, MessageWithSender, CATEGORY_INFO, ThreadCategory } from '../types';
import { supabase } from '../../../lib/supabase';
import { colors } from '@/src/shared/theme/colors';

const ROLE_COLORS = {
  owner: { primary: colors.rsa.blue, secondary: colors.rsa.gold },
  tenant: { primary: colors.rsa.green, secondary: colors.rsa.gold },
};

interface Props {
  role: 'owner' | 'tenant';
}

export default function MessageThreadScreen({ role = 'owner' }: Props) {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const roleColors = ROLE_COLORS[role];
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);

  const [thread, setThread] = useState<ThreadWithRelations | null>(null);
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    initUser();
  }, []);

  useEffect(() => {
    if (id && userId) {
      loadData();
      // Subscribe to new messages
      const threadId = Array.isArray(id) ? id[0] : id;
      const unsubscribe = messagesApi.subscribeToThread(threadId, handleNewMessage);
      return () => unsubscribe();
    }
  }, [id, userId]);

  const initUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
    }
  };

  const loadData = async () => {
    if (!id || !userId) return;

    try {
      const threadId = Array.isArray(id) ? id[0] : id;
      const [threadData, messagesData] = await Promise.all([
        messagesApi.getThread(threadId),
        messagesApi.getThreadMessages(threadId),
      ]);
      setThread(threadData);
      setMessages(messagesData);

      // Mark as read
      await messagesApi.markAsRead(threadId, userId, role);
    } catch (error) {
      console.error('Error loading thread:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewMessage = useCallback((newMessage: any) => {
    setMessages(prev => {
      // Skip if real message ID already in list
      if (prev.some(m => m.id === newMessage.id)) return prev;
      // Replace any optimistic temp message with same content+sender
      const filtered = prev.filter(m =>
        !(String(m.id).startsWith('temp-') &&
          m.content === newMessage.content &&
          m.sender_id === newMessage.sender_id)
      );
      return [...filtered, newMessage];
    });

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    // Mark as read if message is from the other party
    if (newMessage.sender_id !== userId && id) {
      const threadId = Array.isArray(id) ? id[0] : id;
      messagesApi.markAsRead(threadId, userId!, role);
    }
  }, [userId, id, role]);

  const sendMessage = async () => {
    if (!messageText.trim() || !thread || !userId) return;

    const content = messageText.trim();
    setMessageText('');
    Keyboard.dismiss();
    setSending(true);

    // Optimistic update: show message immediately without waiting for real-time
    const tempId = `temp-${Date.now()}`;
    const optimistic: MessageWithSender = {
      id: tempId,
      thread_id: thread.id,
      content,
      sender_id: userId,
      sender_role: role,
      created_at: new Date().toISOString(),
      read_at: null,
      delivered_at: null,
    };
    setMessages(prev => [...prev, optimistic]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);

    try {
      const sent = await messagesApi.sendMessage({
        thread_id: thread.id,
        content,
        sender_id: userId,
        sender_role: role,
      });
      // Replace optimistic message with confirmed DB row
      setMessages(prev => prev.map(m => m.id === tempId ? sent : m));
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove optimistic message and restore text so user can retry
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setMessageText(content);
    } finally {
      setSending(false);
    }
  };

  const getOtherParty = () => {
    if (!thread) return null;
    return role === 'owner' ? thread.tenant : thread.owner;
  };

  const isMyMessage = (message: MessageWithSender) => {
    return message.sender_id === userId;
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-ZA', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
    }
  };

  const shouldShowDate = (index: number) => {
    if (index === 0) return true;
    const current = new Date(messages[index].created_at || '');
    const previous = new Date(messages[index - 1].created_at || '');
    return current.toDateString() !== previous.toDateString();
  };

  const renderMessage = ({ item, index }: { item: MessageWithSender; index: number }) => {
    const isMine = isMyMessage(item);
    const showDate = shouldShowDate(index);

    return (
      <View>
        {showDate && (
          <View style={styles.dateSeparator}>
            <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
          </View>
        )}
        <View style={[styles.messageRow, isMine && styles.messageRowMine]}>
          {!isMine && (
            <View style={styles.messageAvatar}>
              {item.sender?.avatar_url ? (
                <Image source={{ uri: item.sender.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: roleColors.primary }]}>
                  <Text style={styles.avatarText}>
                    {item.sender?.full_name?.charAt(0).toUpperCase() || '?'}
                  </Text>
                </View>
              )}
            </View>
          )}
          <View
            style={[
              styles.messageBubble,
              isMine
                ? [styles.messageBubbleMine, { backgroundColor: roleColors.primary }]
                : styles.messageBubbleOther,
            ]}
          >
            <Text style={[styles.messageText, isMine && styles.messageTextMine]}>
              {item.content}
            </Text>
            <Text style={[styles.messageTime, isMine && styles.messageTimeMine]}>
              {formatTime(item.created_at)}
              {isMine && item.read_at && (
                <Text> · Read</Text>
              )}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const otherParty = getOtherParty();
  const category = thread?.category as ThreadCategory;
  const categoryInfo = category ? CATEGORY_INFO[category] : null;

  const scrollToBottom = () => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={roleColors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            {otherParty?.avatar_url ? (
              <Image source={{ uri: otherParty.avatar_url }} style={styles.headerAvatar} />
            ) : (
              <View style={[styles.headerAvatarPlaceholder, { backgroundColor: roleColors.primary }]}>
                <Text style={styles.headerAvatarText}>
                  {otherParty?.full_name?.charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
            )}
            <View style={styles.headerInfo}>
              <Text style={styles.headerName} numberOfLines={1}>
                {otherParty?.full_name || 'Unknown'}
              </Text>
              {categoryInfo && (
                <View style={styles.categoryTag}>
                  <View style={[styles.categoryDot, { backgroundColor: categoryInfo.color }]} />
                  <Text style={styles.categoryText}>{categoryInfo.label}</Text>
                </View>
              )}
            </View>
          </View>
          {/* Future: Add menu button for thread actions */}
        </View>

        {/* Thread Subject */}
        {thread?.subject && (
          <View style={styles.subjectBar}>
            <Ionicons name="chatbubble-outline" size={16} color={colors.text.secondary} />
            <Text style={styles.subjectText} numberOfLines={1}>
              {thread.subject}
            </Text>
          </View>
        )}

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          style={styles.messagesFlex}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onContentSizeChange={() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubble-outline" size={48} color={colors.gray[300]} />
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>Start the conversation!</Text>
            </View>
          }
        />

        {/* Input Bar */}
        {thread?.status === 'active' ? (
          <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <TextInput
              style={styles.textInput}
              placeholder="Type a message..."
              value={messageText}
              onChangeText={setMessageText}
              multiline
              maxLength={2000}
              onFocus={scrollToBottom}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                { backgroundColor: roleColors.primary },
                (!messageText.trim() || sending) && styles.sendButtonDisabled,
              ]}
              onPress={sendMessage}
              disabled={!messageText.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name="send" size={20} color="#FFF" />
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.closedBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <Ionicons name="lock-closed" size={16} color={colors.text.secondary} />
            <Text style={styles.closedText}>This conversation is closed</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.background.default,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  headerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.inverse,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  categoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  categoryText: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  subjectBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    gap: 8,
  },
  subjectText: {
    flex: 1,
    fontSize: 14,
    color: colors.text.secondary,
  },
  messagesFlex: {
    flex: 1,
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  dateSeparator: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateText: {
    fontSize: 12,
    color: colors.text.tertiary,
    backgroundColor: colors.background.tertiary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-end',
  },
  messageRowMine: {
    justifyContent: 'flex-end',
  },
  messageAvatar: {
    marginRight: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.inverse,
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
  },
  messageBubbleOther: {
    backgroundColor: colors.background.default,
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  messageBubbleMine: {
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 15,
    color: colors.text.primary,
    lineHeight: 20,
  },
  messageTextMine: {
    color: colors.text.inverse,
  },
  messageTime: {
    fontSize: 11,
    color: colors.text.tertiary,
    marginTop: 4,
    textAlign: 'right',
  },
  messageTimeMine: {
    color: 'rgba(255,255,255,0.7)',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.secondary,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.text.tertiary,
    marginTop: 4,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: colors.background.default,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    gap: 8,
  },
  textInput: {
    flex: 1,
    maxHeight: 100,
    backgroundColor: colors.background.tertiary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    color: colors.text.primary,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  closedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: colors.background.tertiary,
    gap: 8,
  },
  closedText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
});
