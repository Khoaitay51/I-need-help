import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import * as Font from "expo-font";
import { storage } from "./src/storage";
import { COLORS } from "./src/theme";
import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import ChatScreen from "./src/screens/ChatScreen";

export default function App() {
  const [appReady, setAppReady] = useState(false);
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login"); // 'login' or 'register'

  useEffect(() => {
    const initApp = async () => {
      try {
        // Load custom fonts (optional - can skip if system fonts are sufficient)
        try {
          await Font.loadAsync({
            // Add any custom fonts here if needed
          });
        } catch (fontError) {
          console.warn("Font loading warning:", fontError);
        }

        // Check for saved user session
        const savedUser = await storage.getUser();
        if (savedUser?.role === "user") {
          setUser(savedUser);
        } else {
          await storage.clearSession();
        }
      } catch (error) {
        console.error("Error initializing app:", error);
      } finally {
        setAppReady(true);
      }
    };

    initApp();
  }, []);

  const handleLoginSuccess = async (userData) => {
    setUser(userData);
    await storage.setUser(userData);
  };

  const handleRegisterSuccess = async (userData) => {
    setUser(userData);
    await storage.setUser(userData);
  };

  const handleLogout = async () => {
    setUser(null);
    await storage.clearSession();
    setAuthMode("login");
  };

  if (!appReady) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.loadingContainer}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" backgroundColor={COLORS.surface} />
        {user ? (
          <ChatScreen user={user} onLogout={handleLogout} />
        ) : authMode === "login" ? (
          <LoginScreen
            onLoginSuccess={handleLoginSuccess}
            onSwitchToRegister={() => setAuthMode("register")}
          />
        ) : (
          <RegisterScreen
            onRegisterSuccess={handleRegisterSuccess}
            onSwitchToLogin={() => setAuthMode("login")}
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.surface,
  },
});
