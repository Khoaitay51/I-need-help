import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authApi } from "../api";
import KMALogo from "../components/KMALogo";
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from "../theme";

const LoginScreen = ({ onLoginSuccess, onSwitchToRegister }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError("Vui lòng nhập username và mật khẩu");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await authApi.login(username.trim(), password);
      if (response.success) {
        onLoginSuccess(response.user);
      } else {
        setError(response.error || "Đăng nhập thất bại");
      }
    } catch (err) {
      setError(err.message || "Lỗi kết nối");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.page} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.card}>
            <View style={styles.logoIcon}>
              <KMALogo size="small" showText={false} />
            </View>

            <View style={styles.header}>
              <Text style={styles.title}>Đăng nhập ACTVN-AGENT</Text>
              <Text style={styles.subtitle}>
                Học viện Kỹ thuật Mật mã
              </Text>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.formGroup}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                style={styles.input}
                placeholder="Nhập username"
                placeholderTextColor={COLORS.outline}
                value={username}
                autoCapitalize="none"
                onChangeText={(text) => {
                  setUsername(text);
                  setError("");
                }}
                editable={!loading}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Mật khẩu</Text>
              <TextInput
                style={styles.input}
                placeholder="Nhập mật khẩu"
                placeholderTextColor={COLORS.outline}
                secureTextEntry
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setError("");
                }}
                editable={!loading}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.disabledButton]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitText}>Đăng nhập</Text>
              )}
            </TouchableOpacity>

            <View style={styles.switchBox}>
              <Text style={styles.switchText}>Chưa có tài khoản?</Text>
              <TouchableOpacity onPress={onSwitchToRegister}>
                <Text style={styles.switchLink}>Đăng ký ngay</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING["3xl"],
  },
  card: {
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.75)",
    borderRadius: 24,
    paddingHorizontal: SPACING["2xl"],
    paddingVertical: SPACING["3xl"],
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 18 },
    shadowRadius: 34,
    elevation: 6,
  },
  logoIcon: {
    width: 62,
    height: 62,
    borderRadius: 18,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 4,
  },
  header: {
    alignItems: "center",
    marginBottom: SPACING["2xl"],
  },
  title: {
    color: COLORS.onSurface,
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: SPACING.sm,
  },
  subtitle: {
    color: COLORS.onSurfaceVariant,
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: "center",
    lineHeight: 21,
  },
  errorBox: {
    backgroundColor: "#fff1f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.lg,
  },
  errorText: {
    color: "#be123c",
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: "600",
  },
  formGroup: {
    marginBottom: SPACING.lg,
  },
  label: {
    color: COLORS.onSurface,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: "700",
    marginBottom: SPACING.sm,
  },
  input: {
    minHeight: 50,
    borderWidth: 1.5,
    borderColor: COLORS.outlineVariant,
    borderRadius: RADIUS.md,
    backgroundColor: "rgba(255,255,255,0.85)",
    color: COLORS.onSurface,
    fontSize: TYPOGRAPHY.fontSize.base,
    paddingHorizontal: SPACING.lg,
  },
  submitButton: {
    minHeight: 52,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: SPACING.sm,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 4,
  },
  disabledButton: {
    opacity: 0.65,
  },
  submitText: {
    color: "#fff",
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: "800",
  },
  switchBox: {
    borderTopWidth: 1,
    borderTopColor: COLORS.outlineVariant,
    marginTop: SPACING["2xl"],
    paddingTop: SPACING.lg,
    flexDirection: "row",
    justifyContent: "center",
    gap: SPACING.sm,
  },
  switchText: {
    color: COLORS.onSurfaceVariant,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  switchLink: {
    color: COLORS.primary,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: "800",
  },
});

export default LoginScreen;
