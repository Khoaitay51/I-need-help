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

const RegisterScreen = ({ onRegisterSuccess, onSwitchToLogin }) => {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    studentCode: "",
    studentClass: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const updateForm = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const validateForm = () => {
    if (!formData.username.trim()) return setError("Vui lòng nhập username"), false;
    if (!formData.email.trim()) return setError("Vui lòng nhập email"), false;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      return setError("Email không hợp lệ"), false;
    }
    if (!formData.studentCode.trim()) return setError("Vui lòng nhập mã sinh viên"), false;
    if (formData.password.length < 6) {
      return setError("Mật khẩu phải có ít nhất 6 ký tự"), false;
    }
    if (formData.password !== formData.confirmPassword) {
      return setError("Mật khẩu xác nhận không khớp"), false;
    }
    return true;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setError("");
    try {
      const response = await authApi.register(formData);
      if (response.success) {
        onRegisterSuccess(response.user);
      } else {
        setError(response.error || "Đăng ký thất bại");
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
              <Text style={styles.title}>Tạo tài khoản ACTVN-AGENT</Text>
              <Text style={styles.subtitle}>Học viện Kỹ thuật Mật mã</Text>
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
                value={formData.username}
                autoCapitalize="none"
                onChangeText={(text) => updateForm("username", text)}
                editable={!loading}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="Nhập email"
                placeholderTextColor={COLORS.outline}
                value={formData.email}
                keyboardType="email-address"
                autoCapitalize="none"
                onChangeText={(text) => updateForm("email", text)}
                editable={!loading}
              />
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, styles.formHalf]}>
                <Text style={styles.label}>Mã sinh viên</Text>
                <TextInput
                  style={styles.input}
                  placeholder="VD: CT060241"
                  placeholderTextColor={COLORS.outline}
                  value={formData.studentCode}
                  autoCapitalize="characters"
                  onChangeText={(text) => updateForm("studentCode", text)}
                  editable={!loading}
                />
              </View>
              <View style={[styles.formGroup, styles.formHalf]}>
                <Text style={styles.label}>Lớp</Text>
                <TextInput
                  style={styles.input}
                  placeholder="VD: CT6A"
                  placeholderTextColor={COLORS.outline}
                  value={formData.studentClass}
                  onChangeText={(text) => updateForm("studentClass", text)}
                  editable={!loading}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Mật khẩu</Text>
              <TextInput
                style={styles.input}
                placeholder="Tối thiểu 6 ký tự"
                placeholderTextColor={COLORS.outline}
                secureTextEntry
                value={formData.password}
                onChangeText={(text) => updateForm("password", text)}
                editable={!loading}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Xác nhận mật khẩu</Text>
              <TextInput
                style={styles.input}
                placeholder="Nhập lại mật khẩu"
                placeholderTextColor={COLORS.outline}
                secureTextEntry
                value={formData.confirmPassword}
                onChangeText={(text) => updateForm("confirmPassword", text)}
                editable={!loading}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.disabledButton]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitText}>Đăng ký</Text>
              )}
            </TouchableOpacity>

            <View style={styles.switchBox}>
              <Text style={styles.switchText}>Đã có tài khoản?</Text>
              <TouchableOpacity onPress={onSwitchToLogin}>
                <Text style={styles.switchLink}>Đăng nhập</Text>
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
    maxWidth: 480,
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
  },
  header: {
    alignItems: "center",
    marginBottom: SPACING["2xl"],
  },
  title: {
    color: COLORS.onSurface,
    fontSize: 23,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: SPACING.sm,
  },
  subtitle: {
    color: COLORS.onSurfaceVariant,
    fontSize: TYPOGRAPHY.fontSize.sm,
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
  formRow: {
    flexDirection: "row",
    gap: SPACING.md,
  },
  formHalf: {
    flex: 1,
  },
  formGroup: {
    marginBottom: SPACING.md,
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

export default RegisterScreen;
