import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
//Temp import will be replaced when backend is ready
import { sendChatMessage } from '../../../mocks/lalaChatMocks';

type Message = {
  id: string;
  text: string;
  role: 'user' | 'ai';
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#E5E5E5',
  },
  headerTitle: { fontSize: 14, fontWeight: '600', color: '#000' },
  headerSub: { fontSize: 12, color: '#737373' },
  listContent: { padding: 16, flexGrow: 1 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: '#000', marginTop: 12 },
  emptySub: {
    fontSize: 12,
    color: '#737373',
    marginTop: 4,
    textAlign: 'center',
    maxWidth: 250,
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  
  },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#007A4D' },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  userText: { color: '#fff', fontSize: 14 },
  aiText: { color: '#000', fontSize: 14 },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  loadingText: { fontSize: 12, color: '#737373' },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 12,
  },
  errorText: { fontSize: 12, color: '#DC2626', flex: 1 },
  retryText: { fontSize: 12, fontWeight: '700', color: '#DC2626' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderColor: '#E5E5E5',
    gap: 8,
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#000',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007A4D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  aiRow: {
    justifyContent: 'flex-start',
  },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5F2EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
});

export default function LalaChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const flatListRef = useRef<FlatList<Message>>(null);



  const fetchAiResponse = async (userText: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const { reply } = await sendChatMessage(userText);
      const newAiMsg: Message = {
        id: Date.now().toString() + '-ai',
        text: reply,
        role: 'ai',
      };
      setMessages(prev => [...prev, newAiMsg]);
    } catch (err) {
      console.error('Chat error:', err);
      setError('Network error. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = () => {
    if (inputText.trim() === '') return;

    const userText = inputText.trim();
    const newUserMsg: Message = {
      id: Date.now().toString() + '-user',
      text: userText,
      role: 'user',
    };

    setMessages(prev => [...prev, newUserMsg]);
    setInputText('');
    fetchAiResponse(userText);
  };

  const handleRetry = () => {
    const lastUserMsg = messages.filter((m: Message) => m.role === 'user').pop();
    if (lastUserMsg) {
      fetchAiResponse(lastUserMsg.text);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      
        <View style={styles.header}>
          <Ionicons name="chatbubble-ellipses-outline" size={20} color="#007A4D" />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.headerTitle}>Lala Assistant</Text>
            <Text style={styles.headerSub}>Property Support</Text>
          </View>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item: Message) => item.id}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({animated: true})}
          onLayout={() => flatListRef.current?.scrollToEnd({animated: true})}
          ListEmptyComponent={
            !isLoading && !error ? (
              <View style={styles.emptyState}>
                <Ionicons name="chatbubble-outline" size={40} color="#737373" />
                <Text style={styles.emptyTitle}>Ask me anything about your property</Text>
                <Text style={styles.emptySub}>
                  Rent, maintenance, lease details, and more.
                </Text>
              </View>
            ) : null
          }
         renderItem={({ item }: { item: Message }) => (
            <View
              style={[
                styles.messageRow,
                item.role === 'user' ? styles.userRow : styles.aiRow,
              ]}
            >
              {/* Show the AI Icon only if the sender is 'ai' */}
              {item.role === 'ai' && (
                <View style={styles.aiAvatar}>
                  <Ionicons name="chatbubble-ellipses-outline" size={16} color="#007A4D" />
                </View>
              )}

              
              <View
                style={[
                  styles.bubble,
                  item.role === 'user' ? styles.userBubble : styles.aiBubble,
                ]}
              >
                <Text style={item.role === 'user' ? styles.userText : styles.aiText}>
                  {item.text}
                </Text>
              </View>
            </View>
          )}
        />

        
        {isLoading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#007A4D" />
            <Text style={styles.loadingText}>Lala is typing...</Text>
          </View>
        )}

        {/* Error state */}
        {error && (
          <View style={styles.errorRow}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={handleRetry}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        )}

        
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type your message..."
            placeholderTextColor="#737373"
            editable={!isLoading}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <Pressable
            style={[
              styles.sendBtn,
              (!inputText.trim() || isLoading) && styles.sendBtnDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || isLoading}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}