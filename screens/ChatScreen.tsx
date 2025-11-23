import React, { useEffect, useState, useLayoutEffect, useRef } from "react";
import {
  View, Text, TextInput, FlatList, StyleSheet,
  KeyboardAvoidingView, Platform, TouchableOpacity
} from "react-native";
import { 
  addDoc, serverTimestamp, query, orderBy, onSnapshot, 
  messagesCollection, auth, signOut 
} from "../firebase";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../App";
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from "@react-native-community/netinfo";
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

type Props = NativeStackScreenProps<RootStackParamList, "Chat">;

type MessageType = {
  id: string; 
  text: string; 
  user: string; 
  createdAt: number;
  status: 'pending' | 'sent'; 
};

export default function ChatScreen({ navigation, route }: Props) {
  const { name } = route.params;
  const [message, setMessage] = useState<string>("");
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [isOffline, setIsOffline] = useState(false); // Status koneksi real-time
  
  const flatListRef = useRef<FlatList>(null);

  // LOGOUT
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => signOut(auth)} style={{marginRight: 10}}>
           <Icon name="logout" size={24} color="#FF3B30" />
        </TouchableOpacity>
      ),
      headerLeft: undefined, 
    });
  }, [navigation]);

  // 1. MONITOR KONEKSI & PROSES ANTRIAN
  useEffect(() => {
    loadCache(); // Load data lama saat buka aplikasi

    const unsubscribeNet = NetInfo.addEventListener(state => {
      const online = state.isConnected && state.isInternetReachable;
      setIsOffline(!online);

      if (online) {
        processOfflineQueue(); // <--- INI KUNCINYA: Kirim antrian saat online
      }
    });
    return () => unsubscribeNet();
  }, []);

  // Fungsi Memproses Antrian (Otak Cerdas ala WhatsApp)
  const processOfflineQueue = async () => {
    try {
      // Ambil antrian dari gudang
      const queueJson = await AsyncStorage.getItem("offline_queue");
      if (!queueJson) return;

      const queue: MessageType[] = JSON.parse(queueJson);
      if (queue.length === 0) return;

      console.log(`Mengirim ${queue.length} pesan pending...`);

      // Kirim satu per satu ke Firebase
      for (const msg of queue) {
        await addDoc(messagesCollection, {
          text: msg.text,
          user: msg.user,
          createdAt: serverTimestamp(),
        });
      }

      // Kalau sukses semua, kosongkan antrian
      await AsyncStorage.removeItem("offline_queue");
      console.log("Semua antrian terkirim!");
      
    } catch (e) {
      console.log("Gagal proses antrian");
    }
  };

  // 2. LISTEN FIREBASE (Untuk Data Real-time)
  useEffect(() => {
    const q = query(messagesCollection, orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const serverMessages: MessageType[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        serverMessages.push({
          id: doc.id,
          text: data.text,
          user: data.user,
          createdAt: data.createdAt ? data.createdAt.seconds * 1000 : new Date().getTime(),
          status: 'sent' // Kalau dari server pasti 'sent'
        });
      });

      setMessages(currentLocal => {
        // Gabungkan: Data Server + Data Pending Lokal yang BELUM masuk server
        const pendingOnly = currentLocal.filter(m => 
          m.status === 'pending' && 
          !serverMessages.some(sm => sm.text === m.text && sm.user === m.user)
        );
        
        const combined = [...serverMessages, ...pendingOnly];
        combined.sort((a, b) => a.createdAt - b.createdAt);
        
        // Simpan update terbaru ke HP
        AsyncStorage.setItem("chat_history", JSON.stringify(combined));
        
        return combined;
      });

    }, (err) => { /* Silent kalau offline */ }); 

    return () => unsubscribe();
  }, []);

  // 3. LOAD DATA LAMA
  const loadCache = async () => {
    try {
      const cached = await AsyncStorage.getItem("chat_history");
      if (cached) setMessages(JSON.parse(cached));
    } catch (e) {}
  };

  // 4. KIRIM PESAN (Logic Offline Queue)
  const sendMessage = async () => {
    if (!message.trim()) return;

    const now = new Date().getTime();
    const tempMsg: MessageType = {
      id: "temp_" + now,
      text: message,
      user: name,
      createdAt: now,
      status: 'pending'
    };

    // A. Update UI Langsung (Biar terasa cepat)
    setMessages(prev => {
      const next = [...prev, tempMsg];
      AsyncStorage.setItem("chat_history", JSON.stringify(next));
      return next;
    });
    setMessage("");

    // B. Cek Koneksi
    const state = await NetInfo.fetch();
    if (state.isConnected && state.isInternetReachable) {
      // Kalau Online: Langsung Kirim
      try {
        await addDoc(messagesCollection, {
          text: tempMsg.text, user: tempMsg.user, createdAt: serverTimestamp()
        });
      } catch (e) {
        // Kalau gagal kirim mendadak, masukkan ke antrian
        saveToQueue(tempMsg);
      }
    } else {
      // Kalau Offline: Masukkan ke Antrian (Queue)
      saveToQueue(tempMsg);
    }
  };

  // Fungsi Simpan ke Keranjang Antrian
  const saveToQueue = async (msg: MessageType) => {
    try {
      const currentQueue = await AsyncStorage.getItem("offline_queue");
      let queue = currentQueue ? JSON.parse(currentQueue) : [];
      queue.push(msg);
      await AsyncStorage.setItem("offline_queue", JSON.stringify(queue));
      console.log("Disimpan ke antrian offline");
    } catch (e) {}
  };

  // --- FORMATTING UI ---
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const renderItem = ({ item }: { item: MessageType }) => {
    const isMe = item.user === name;
    return (
      <View style={[styles.row, isMe ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
        <View style={[styles.bubble, isMe ? styles.myBubble : styles.otherBubble]}>
          {!isMe && <Text style={styles.senderName}>{item.user}</Text>}
          
          <View style={styles.contentContainer}>
             <Text style={[styles.messageText, { color: isMe ? '#fff' : '#000' }]}>{item.text}</Text>
             <View style={styles.metaContainer}>
                <Text style={[styles.timeText, { color: isMe ? 'rgba(255,255,255,0.7)' : '#999' }]}>
                  {formatTime(item.createdAt)}
                </Text>
                {isMe && (
                  <View style={{marginLeft: 4}}>
                    {item.status === 'pending' ? (
                      <Icon name="clock-outline" size={14} color="rgba(255,255,255,0.7)" />
                    ) : (
                      <Icon name="check-all" size={16} color="#fff" />
                    )}
                  </View>
                )}
             </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.container}> 
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          contentContainerStyle={{ padding: 10, paddingBottom: 20 }}
        />
        
        <View style={styles.inputContainer}>
          <TextInput 
            style={styles.input} 
            placeholder="Ketik pesan..." 
            placeholderTextColor="#999"
            value={message} 
            onChangeText={setMessage} 
          />
          <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
             <Icon name="send" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
  row: { flexDirection: 'row', marginBottom: 8 },
  bubble: { maxWidth: '80%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, minWidth: 80 },
  myBubble: { backgroundColor: "#007aff", borderBottomRightRadius: 2 }, 
  otherBubble: { backgroundColor: "#f2f2f7", borderBottomLeftRadius: 2 }, 
  senderName: { color: '#FF9500', fontWeight: 'bold', fontSize: 12, marginBottom: 2 },
  contentContainer: { flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap' },
  messageText: { fontSize: 16, lineHeight: 22, paddingRight: 6 },
  metaContainer: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto', paddingTop: 4 },
  timeText: { fontSize: 11 },
  inputContainer: { flexDirection: "row", padding: 10, backgroundColor: "#ffffff", alignItems: "center", borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  input: { flex: 1, backgroundColor: "#f2f2f7", color: 'black', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, marginRight: 10, borderWidth: 0 },
  sendButton: { backgroundColor: '#007aff', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
});