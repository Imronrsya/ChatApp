// ChatScreen.tsx (dengan Image Preview & Caption seperti WhatsApp)
import React, { useEffect, useState, useLayoutEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  Image,
  ActivityIndicator,
  Modal,
  Keyboard,
  Animated,
  BackHandler,
  KeyboardAvoidingView,
  Dimensions,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  QuerySnapshot,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import {
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  messagesCollection,
  auth,
  signOut,
  updateDoc,
  doc,
  db,
} from "../firebase";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../App";
import Icon from "react-native-vector-icons/Feather";
import { storage as mmkvStorage } from "../utils/storage";
import { launchImageLibrary } from 'react-native-image-picker';
import NetInfo from "@react-native-community/netinfo";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const generateUniqueId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
};

const getDateFromTimestamp = (timestamp: any): Date => {
  if (!timestamp) return new Date();
  if (timestamp.toDate) return timestamp.toDate();
  if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
  return new Date(timestamp);
};

const formatTime = (timestamp: any) => {
  const date = getDateFromTimestamp(timestamp);
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
};

const formatDatePill = (timestamp: any) => {
  const date = getDateFromTimestamp(timestamp);
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === now.toDateString()) return "Hari Ini";
  if (date.toDateString() === yesterday.toDateString()) return "Kemarin";
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

type MessageType = {
  id: string;
  text: string;
  image?: string;
  user: string;
  createdAt: any;
  pending?: boolean;
  clientMessageId?: string;
  delivered?: boolean;
  read?: boolean;
};

type Props = NativeStackScreenProps<RootStackParamList, "Chat">;

export default function ChatScreen({ route, navigation }: Props) {
  const [message, setMessage] = useState<string>("");
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [pendingMessages, setPendingMessages] = useState<MessageType[]>([]);

  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // State untuk image preview dengan caption (seperti WhatsApp)
  const [imagePreviewModal, setImagePreviewModal] = useState(false);
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);
  const [imageCaption, setImageCaption] = useState<string>("");

  const [isConnected, setIsConnected] = useState<boolean | null>(true);
  const [bannerText, setBannerText] = useState("Koneksi terputus");
  const [bannerColor, setBannerColor] = useState("#808080");
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const wasOffline = useRef(false);

  const flatListRef = useRef<FlatList>(null);
  const captionInputRef = useRef<TextInput>(null);
  const lastReadTimestamp = useRef<number>(Date.now());
  const hasMarkedAsRead = useRef<Set<string>>(new Set());

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: (props: any) => {
        return (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#000' }}>{props.children}</Text>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: isConnected ? '#007AFF' : '#808080', marginLeft: 8, marginTop: 2 }} />
          </View>
        );
      },
      headerRight: () => (
        <TouchableOpacity onPress={handleLogout} style={{ marginRight: 10 }}>
          <Icon name="log-out" size={24} color="#FF3B30" />
        </TouchableOpacity>
      ),
      headerBackVisible: false,
    });
  }, [navigation, isConnected]);

  const showToast = (text: string, type: 'offline' | 'online') => {
    setBannerText(text);
    setBannerColor(type === 'offline' ? '#666666' : '#2196F3');
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    setTimeout(() => Animated.timing(fadeAnim, { toValue: 0, duration: 500, useNativeDriver: true }).start(), 3000);
  };

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const online = state.isConnected === true;
      setIsConnected(online);
      if (!online) {
        wasOffline.current = true;
        showToast("Offline", "offline");
      } else {
        if (wasOffline.current) {
          showToast("Kembali online", "online");
          wasOffline.current = false;
          if (pendingMessages.length > 0) syncPendingMessages();
        }
      }
    });
    return () => unsubscribe();
  }, [pendingMessages]);

  const syncPendingMessages = async () => {
    const queueString = mmkvStorage.getString('offline_queue');
    if (!queueString) return;
    let queue: MessageType[] = [];
    try { queue = JSON.parse(queueString); } catch (e) { console.log("Parse queue error", e); mmkvStorage.remove('offline_queue'); return; }
    if (queue.length === 0) { mmkvStorage.remove('offline_queue'); return; }

    showToast("Mengirim pesan tertunda...", "online");
    const remainingQueue: MessageType[] = [];
    for (const msg of queue) {
      try {
        await addDoc(messagesCollection, {
          text: msg.text,
          image: msg.image || null,
          user: msg.user,
          createdAt: serverTimestamp(),
          clientMessageId: msg.clientMessageId || generateUniqueId(),
        });
      } catch (error) {
        remainingQueue.push(msg);
      }
    }

    setPendingMessages(remainingQueue);
    if (remainingQueue.length > 0) {
      mmkvStorage.set('offline_queue', JSON.stringify(remainingQueue));
    } else {
      mmkvStorage.remove('offline_queue');
      showToast("Semua pesan terkirim", "online");
    }
  };

  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (imagePreviewModal) {
        setImagePreviewModal(false);
        setPreviewImageUri(null);
        setImageCaption("");
        return true;
      }
      Keyboard.dismiss();
      return false;
    });
    return () => backHandler.remove();
  }, [imagePreviewModal]);

  function handleLogout() {
    Alert.alert("Keluar", "Yakin ingin logout?", [
      { text: "Batal", style: "cancel" },
      { text: "Ya", style: "destructive", onPress: async () => {
          try { mmkvStorage.clearAll(); await signOut(auth); } catch (e) { console.log("Logout error:", e); mmkvStorage.clearAll(); }
      } }
    ]);
  }

  useEffect(() => {
    let isMounted = true;
    const loadLocalChat = () => {
      const savedChat = mmkvStorage.getString('chat_history');
      if (savedChat) {
        try {
          const parsed = JSON.parse(savedChat);
          if (isMounted) setMessages(parsed);
        } catch (e) { console.log("Failed parse chat_history", e); }
      }
    };
    loadLocalChat();

    const loadQueue = () => {
      const savedQueue = mmkvStorage.getString('offline_queue');
      if (savedQueue) {
        try {
          const parsed = JSON.parse(savedQueue);
          if (isMounted) setPendingMessages(parsed);
        } catch (e) { console.log("Failed parse offline_queue", e); }
      }
    };
    loadQueue();

    const q = query(messagesCollection, orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, { includeMetadataChanges: true }, (snapshot: QuerySnapshot) => {
      if (!isMounted) return;
      const source = snapshot.metadata.fromCache ? "local cache" : "server";
      if (snapshot.empty) {
        console.log("[Firestore] Snapshot empty from", source);
        return;
      }
      const list: MessageType[] = [];
      const currentUser = mmkvStorage.getString('user.name') || auth.currentUser?.email || "User";
      
      snapshot.forEach((doc: QueryDocumentSnapshot) => {
        const data = doc.data() as Omit<MessageType,"id">;
        const isOtherMessage = data.user !== currentUser;
        
        list.push({ 
          id: doc.id, 
          ...data,
          delivered: true,
          read: data.read || false
        });
        
        // Auto mark pesan dari orang lain sebagai read
        if (isOtherMessage && !data.read && !hasMarkedAsRead.current.has(doc.id)) {
          hasMarkedAsRead.current.add(doc.id);
          // Update Firestore: mark as read
          updateDoc(doc.ref, { read: true }).catch(err => {
            console.log("Failed to mark as read:", err);
            hasMarkedAsRead.current.delete(doc.id);
          });
        }
      });
      
      setMessages(list);
      try { mmkvStorage.set('chat_history', JSON.stringify(list)); } catch (e) { console.log("MMKV write error", e); }
      
      lastReadTimestamp.current = Date.now();
      
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }, (error) => {
      console.log("Firestore onSnapshot error:", error);
      loadLocalChat();
    });

    return () => { isMounted = false; unsub(); };
  }, []);

  const sendMessage = async (imageUrl: string | null = null, caption: string = "") => {
    const messageText = caption || message;
    if (!messageText.trim() && !imageUrl) return;
    if (sending) return;
    const currentUser = mmkvStorage.getString('user.name') || auth.currentUser?.email || "User";
    const tempId = generateUniqueId();

    if (isConnected === false) {
      const tempMsg: MessageType = { 
        id: `temp_${tempId}`, 
        text: messageText, 
        image: imageUrl || undefined, 
        user: currentUser, 
        createdAt: Date.now(), 
        pending: true, 
        clientMessageId: tempId,
        delivered: false,
        read: false
      };
      const newPending = [...pendingMessages, tempMsg];
      setPendingMessages(newPending);
      try { mmkvStorage.set('offline_queue', JSON.stringify(newPending)); } catch (e) { console.log("MMKV save queue err", e); }
      setMessage("");
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      showToast("Pesan akan dikirim saat Anda kembali online", "offline");
      return;
    }

    setSending(true);
    try {
      await addDoc(messagesCollection, {
        text: messageText,
        image: imageUrl || null,
        user: currentUser,
        createdAt: serverTimestamp(),
        clientMessageId: tempId,
        delivered: true,
        read: false
      });
      setMessage("");
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error) {
      console.log("Send error:", error);
      showToast("Jaringan lambat. Disimpan ke antrian.", "offline");
      const fallbackMsg: MessageType = { 
        id: `temp_${tempId}`, 
        text: messageText, 
        image: imageUrl || undefined, 
        user: currentUser, 
        createdAt: Date.now(), 
        pending: true, 
        clientMessageId: tempId,
        delivered: false,
        read: false
      };
      const newPending = [...pendingMessages, fallbackMsg];
      setPendingMessages(newPending);
      try { mmkvStorage.set('offline_queue', JSON.stringify(newPending)); } catch (e) { console.log("MMKV save queue err", e); }
      setMessage("");
    } finally {
      setSending(false);
    }
  };

  const pickImage = async () => {
    const result = await launchImageLibrary({ 
      mediaType: 'photo', 
      quality: 0.6, 
      includeBase64: true, 
      maxWidth: 1200, 
      maxHeight: 1200 
    });
    
    if (!result || result.didCancel || result.errorCode) return;
    const asset = result.assets?.[0];
    if (!asset) return;
    
    if (asset.base64) {
      const fullBase64 = `data:${asset.type || 'image/jpeg'};base64,${asset.base64}`;
      if (fullBase64.length > 1_200_000) { 
        Alert.alert("Gagal", "Gambar terlalu besar."); 
        return; 
      }
      // Tampilkan preview modal
      setPreviewImageUri(fullBase64);
      setImagePreviewModal(true);
      // Auto focus ke input caption setelah modal terbuka
      setTimeout(() => captionInputRef.current?.focus(), 300);
    } else if (asset.uri) {
      setPreviewImageUri(asset.uri);
      setImagePreviewModal(true);
      setTimeout(() => captionInputRef.current?.focus(), 300);
    }
  };

  const handleSendImageWithCaption = async () => {
    if (!previewImageUri) return;
    
    setImagePreviewModal(false);
    setUploading(true);
    
    await sendMessage(previewImageUri, imageCaption);
    
    // Reset state
    setPreviewImageUri(null);
    setImageCaption("");
    setUploading(false);
  };

  const handleCancelImagePreview = () => {
    setImagePreviewModal(false);
    setPreviewImageUri(null);
    setImageCaption("");
  };

  const displayedMessages = [...messages, ...pendingMessages];

  const renderItem = ({ item, index }: { item: MessageType, index: number }) => {
    const currentUser = mmkvStorage.getString('user.name') || auth.currentUser?.email || "User";
    const isMyMessage = item.user === currentUser;

    const showDatePill = () => {
      if (index === 0) return true;
      const prev = displayedMessages[index - 1];
      const curDate = getDateFromTimestamp(item.createdAt).toDateString();
      const prevDate = getDateFromTimestamp(prev.createdAt).toDateString();
      return curDate !== prevDate;
    };

    // Render status check marks
    const renderCheckMarks = () => {
      if (!isMyMessage) return null;
      
      if (item.pending) {
        // Clock icon untuk pending
        return <Icon name="clock" size={12} color="#999" style={{ marginLeft: 10 }} />;
      }
      
      if (item.read) {
        // Double check biru (sudah dibaca)
        return (
          <View style={{ flexDirection: 'row', marginLeft: 10 }}>
            <Icon name="check" size={12} color="#4FC3F7" style={{ marginLeft: -6 }} />
            <Icon name="check" size={12} color="#4FC3F7" style={{ marginLeft: -6 }} />
          </View>
        );
      }
      
      if (item.delivered) {
        // Double check abu-abu (terkirim)
        return (
          <View style={{ flexDirection: 'row', marginLeft: 10 }}>
            <Icon name="check" size={12} color="#999" style={{ marginLeft: -6 }} />
            <Icon name="check" size={12} color="#999" style={{ marginLeft: -6 }} />
          </View>
        );
      }
      
      // Single check abu-abu (sent)
      return <Icon name="check" size={12} color="#999" style={{ marginLeft: 10 }} />;
    };

    return (
      <View>
        {showDatePill() && (
          <View style={styles.datePill}><Text style={styles.datePillText}>{formatDatePill(item.createdAt)}</Text></View>
        )}
        <View style={[styles.messageRow, { justifyContent: isMyMessage ? 'flex-end' : 'flex-start' }]}>
          <View style={[styles.msgBox, isMyMessage ? styles.myMsg : styles.otherMsg]}>
            {!isMyMessage && <Text style={styles.sender}>{item.user}</Text>}
            {item.image && (
              <TouchableOpacity onPress={() => setSelectedImage(item.image!)}>
                <Image source={{ uri: item.image }} style={styles.chatImage} resizeMode="cover" />
              </TouchableOpacity>
            )}
            {item.text ? <Text style={styles.msgText}>{item.text}</Text> : null}
            <View style={styles.timeContainer}>
              <Text style={styles.timeText}>{formatTime(item.createdAt)}</Text>
              {renderCheckMarks()}
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Animated.View style={[styles.toastContainer, { opacity: fadeAnim, backgroundColor: bannerColor }]}>
        <Text style={styles.toastText}>{bannerText}</Text>
      </Animated.View>

      <FlatList
        ref={flatListRef}
        data={displayedMessages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 10, paddingBottom: 20 }}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        keyboardDismissMode="on-drag"
      />

      <View style={styles.inputRow}>
        <TouchableOpacity onPress={pickImage} disabled={uploading} style={styles.iconButton}>
          {uploading ? <ActivityIndicator size="small" color="#007AFF" /> : <Icon name="plus" size={24} color="#007AFF" />}
        </TouchableOpacity>

        <TextInput 
          style={styles.input} 
          placeholder="Ketik pesan..." 
          placeholderTextColor="#888" 
          value={message} 
          onChangeText={setMessage}
          multiline={false}
        />

        <TouchableOpacity onPress={() => sendMessage(null)} style={[styles.iconButton, sending && styles.disabledButton]} disabled={sending}>
          <Icon name="send" size={24} color={sending ? "#ccc" : "#007AFF"} />
        </TouchableOpacity>
      </View>

      {/* Modal untuk view full image */}
      <Modal visible={selectedImage !== null} transparent animationType="fade" onRequestClose={() => setSelectedImage(null)}>
        <SafeAreaView style={styles.modalContainer}>
          <TouchableOpacity style={styles.closeButtonContainer} onPress={() => setSelectedImage(null)}>
            <View style={styles.closeButton}><Icon name="x" size={30} color="white" /></View>
          </TouchableOpacity>
          {selectedImage && <Image source={{ uri: selectedImage }} style={styles.fullImage} resizeMode="contain" />}
        </SafeAreaView>
      </Modal>

      {/* Modal untuk Image Preview dengan Caption (seperti WhatsApp) */}
      <Modal 
        visible={imagePreviewModal} 
        transparent 
        animationType="slide" 
        onRequestClose={handleCancelImagePreview}
      >
        <KeyboardAvoidingView 
          style={styles.previewModalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Header dengan tombol close */}
          <View style={styles.previewHeader}>
            <TouchableOpacity onPress={handleCancelImagePreview} style={styles.previewCloseButton}>
              <Icon name="x" size={28} color="white" />
            </TouchableOpacity>
          </View>

          {/* Image Preview */}
          <View style={styles.previewImageContainer}>
            {previewImageUri && (
              <Image 
                source={{ uri: previewImageUri }} 
                style={styles.previewImage} 
                resizeMode="contain" 
              />
            )}
          </View>

          {/* Caption Input di bawah */}
          <View style={styles.previewInputContainer}>
            <TextInput
              ref={captionInputRef}
              style={styles.captionInput}
              placeholder="Tambah keterangan..."
              placeholderTextColor="#999"
              value={imageCaption}
              onChangeText={setImageCaption}
              multiline
            />
            <TouchableOpacity 
              onPress={handleSendImageWithCaption} 
              style={styles.previewSendButton}
              disabled={sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Icon name="send" size={24} color="white" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f2' },
  toastContainer: { position: 'absolute', top: 20, alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, zIndex: 20, elevation: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
  toastText: { color: 'white', fontSize: 14, fontWeight: '600' },
  msgBox: { padding: 10, paddingBottom: 6, marginVertical: 4, borderRadius: 12, maxWidth: "75%", minWidth: 80 },
  myMsg: { backgroundColor: "#d1f0ff", alignSelf: "flex-end" },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 5 },
  pendingIcon: { marginRight: 5, marginBottom: 8 },
  otherMsg: { backgroundColor: "#eee", alignSelf: "flex-start" },
  sender: { fontWeight: "bold", marginBottom: 4, fontSize: 10, color: '#555', opacity: 0.8 },
  msgText: { fontSize: 16, color: '#000' },
  chatImage: { width: 200, height: 200, borderRadius: 8, marginBottom: 5, backgroundColor: '#ddd' },
  inputRow: { flexDirection: "row", padding: 10, borderTopWidth: 1, borderColor: "#ccc", backgroundColor: "#fff", alignItems: 'center' },
  input: { flex: 1, borderWidth: 1, borderColor: "#ccc", marginHorizontal: 10, padding: 10, borderRadius: 20, backgroundColor: '#fafafa', height: 45, color: '#000' },
  iconButton: { padding: 5 },
  disabledButton: { opacity: 0.5 },
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  closeButtonContainer: { position: 'absolute', top: 40, right: 20, zIndex: 1 },
  closeButton: { padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  fullImage: { width: '100%', height: '80%' },
  datePill: { alignSelf: 'center', backgroundColor: '#e0e0e0', paddingVertical: 4, paddingHorizontal: 12, borderRadius: 12, marginVertical: 10, opacity: 0.8 },
  datePillText: { fontSize: 11, fontWeight: 'bold', color: '#555' },
  timeContainer: { alignSelf: 'flex-end', marginTop: 4, marginLeft: 8, flexDirection: 'row', alignItems: 'center' },
  timeText: { fontSize: 10, color: '#555', opacity: 0.7 },
  
  // Styles untuk Image Preview Modal (seperti WhatsApp)
  previewModalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  previewHeader: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  previewCloseButton: {
    padding: 10,
  },
  previewImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.6,
  },
  previewInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  captionInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 16,
    maxHeight: 100,
    marginRight: 10,
  },
  previewSendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
});