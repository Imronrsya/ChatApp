import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../App";
import {
  auth,
  signInWithEmailAndPassword,
} from "../firebase";
import { storage } from "../utils/storage";
import Icon from "react-native-vector-icons/Feather";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");

  const [loadingLogin, setLoadingLogin] = useState<boolean>(false);
  const [passwordHidden, setPasswordHidden] = useState<boolean>(true);

  // ====================
  // LOGIN EMAIL
  // ====================
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Email dan Password wajib diisi!");
      return;
    }

    setLoadingLogin(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Simpan session ke MMKV
      storage.set("user.uid", user.uid);
      if (user.email) storage.set("user.email", user.email);

      const displayName = user.displayName || user.email || "User";
      storage.set("user.name", displayName);

      // Tidak perlu navigate → App.tsx akan membaca MMKV & redirect

    } catch (error: any) {
      Alert.alert("Login Gagal", "Email atau password salah.");
    } finally {
      setLoadingLogin(false);
    }
  };

  // ====================
  // REGISTER (NAVIGATE)
  // ====================
  const handleGoToRegister = () => {
    navigation.navigate("Register");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Chat App</Text>
      <Text style={styles.subtitle}>Silakan login untuk melanjutkan</Text>

      {/* Input Email */}
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#888"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      {/* Input Password + Icon */}
      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.inputPassword}
          placeholder="Password"
          placeholderTextColor="#888"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={passwordHidden}
        />
        <TouchableOpacity onPress={() => setPasswordHidden(!passwordHidden)}>
          <Icon name={passwordHidden ? "eye-off" : "eye"} size={24} color="grey" />
        </TouchableOpacity>
      </View>

      {/* Tombol Login */}
      <TouchableOpacity
        style={styles.button}
        onPress={handleLogin}
        disabled={loadingLogin}
      >
        {loadingLogin ? (
          <ActivityIndicator size="small" color="#FFF" />
        ) : (
          <Text style={styles.buttonText}>Login</Text>
        )}
      </TouchableOpacity>

      {/* Link Register */}
      <View style={styles.registerContainer}>
        <Text style={styles.registerText}>Belum punya akun? </Text>
        <TouchableOpacity onPress={handleGoToRegister}>
          <Text style={styles.registerLink}>Daftar di sini</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#FFF"
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 25,
  },
  input: {
    width: "100%",
    height: 50,
    borderWidth: 1,
    borderColor: "#E6E6E6",
    backgroundColor: "#F8F8F8",
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    height: 50,
    borderWidth: 1,
    borderColor: "#E6E6E6",
    backgroundColor: "#F8F8F8",
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  inputPassword: {
    flex: 1,
    fontSize: 16,
  },
  button: {
    width: "100%",
    height: 50,
    backgroundColor: "#007AFF",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 5,
  },
  buttonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  registerContainer: {
    flexDirection: "row",
    marginTop: 18,
  },
  registerText: {
    color: "#666",
  },
  registerLink: {
    color: "#007AFF",
    fontWeight: "bold",
  },
});