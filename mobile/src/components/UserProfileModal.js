import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authApi } from "../api";
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from "../theme";

const UserProfileModal = ({ user, onClose, onLogout, onUserUpdate }) => {
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profile, setProfile] = useState({
    username: user?.username || "",
    email: user?.email || "",
    name: user?.name || "",
    studentCode: user?.studentCode || "",
    studentClass: user?.studentClass || "",
  });
  const [password, setPassword] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const updateProfileField = (field, value) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const updatePasswordField = (field, value) => {
    setPassword((prev) => ({ ...prev, [field]: value }));
  };

  const saveProfile = async () => {
    if (!profile.username.trim()) {
      Alert.alert("Lỗi", "Username không được để trống");
      return;
    }

    setSavingProfile(true);
    const response = await authApi.updateProfile(profile);
    setSavingProfile(false);

    if (response.success) {
      onUserUpdate?.(response.user);
      Alert.alert("Thành công", "Đã cập nhật thông tin cá nhân");
    } else {
      Alert.alert("Lỗi", response.error || "Không thể cập nhật thông tin");
    }
  };

  const savePassword = async () => {
    if (!password.currentPassword || !password.newPassword) {
      Alert.alert("Lỗi", "Vui lòng nhập đầy đủ mật khẩu");
      return;
    }
    if (password.newPassword.length < 6) {
      Alert.alert("Lỗi", "Mật khẩu mới phải có ít nhất 6 ký tự");
      return;
    }
    if (password.newPassword !== password.confirmPassword) {
      Alert.alert("Lỗi", "Mật khẩu mới không khớp");
      return;
    }

    setSavingPassword(true);
    const response = await authApi.changePassword(password);
    setSavingPassword(false);

    if (response.success) {
      setPassword({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      Alert.alert("Thành công", "Đã đổi mật khẩu");
    } else {
      Alert.alert("Lỗi", response.error || "Không thể đổi mật khẩu");
    }
  };

  return (
    <SafeAreaView style={styles.overlay}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Tài khoản</Text>
            <Text style={styles.subtitle}>Thông tin và bảo mật</Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>×</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.profileHead}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(profile.name || profile.username || "U")[0]?.toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileHeadText}>
              <Text style={styles.displayName} numberOfLines={1}>
                {profile.name || profile.username || "Người dùng"}
              </Text>
              <Text style={styles.metaText} numberOfLines={1}>
                {profile.studentCode || profile.email || "Tài khoản người dùng"}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Thông tin cá nhân</Text>
            <View style={styles.grid}>
              <Field
                label="Username"
                value={profile.username}
                onChangeText={(text) => updateProfileField("username", text)}
              />
              <Field
                label="Email"
                value={profile.email}
                keyboardType="email-address"
                autoCapitalize="none"
                onChangeText={(text) => updateProfileField("email", text)}
              />
              <Field
                label="Họ tên"
                value={profile.name}
                onChangeText={(text) => updateProfileField("name", text)}
              />
              <Field
                label="Mã sinh viên"
                value={profile.studentCode}
                autoCapitalize="characters"
                onChangeText={(text) => updateProfileField("studentCode", text)}
              />
              <Field
                label="Lớp"
                value={profile.studentClass}
                onChangeText={(text) => updateProfileField("studentClass", text)}
              />
            </View>
            <TouchableOpacity
              style={[styles.primaryButton, savingProfile && styles.disabledButton]}
              onPress={saveProfile}
              disabled={savingProfile}
            >
              {savingProfile ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Lưu thông tin</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Đổi mật khẩu</Text>
            <View style={styles.grid}>
              <Field
                label="Mật khẩu hiện tại"
                value={password.currentPassword}
                secureTextEntry
                onChangeText={(text) => updatePasswordField("currentPassword", text)}
              />
              <Field
                label="Mật khẩu mới"
                value={password.newPassword}
                secureTextEntry
                onChangeText={(text) => updatePasswordField("newPassword", text)}
              />
              <Field
                label="Nhập lại mật khẩu mới"
                value={password.confirmPassword}
                secureTextEntry
                onChangeText={(text) => updatePasswordField("confirmPassword", text)}
              />
            </View>
            <TouchableOpacity
              style={[styles.primaryButton, savingPassword && styles.disabledButton]}
              onPress={savePassword}
              disabled={savingPassword}
            >
              {savingPassword ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Đổi mật khẩu</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={() => {
              Alert.alert("Đăng xuất", "Bạn có chắc chắn muốn đăng xuất?", [
                { text: "Hủy", style: "cancel" },
                { text: "Đăng xuất", style: "destructive", onPress: onLogout },
              ]);
            }}
          >
            <Text style={styles.logoutText}>Đăng xuất</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const Field = ({ label, ...props }) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={styles.input}
      placeholderTextColor={COLORS.outline}
      {...props}
    />
  </View>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15,20,25,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "94%",
    backgroundColor: COLORS.surfaceSecondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outlineVariant,
  },
  title: {
    color: COLORS.onSurface,
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: "800",
  },
  subtitle: {
    color: COLORS.onSurfaceVariant,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: 2,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surfaceTertiary,
  },
  closeText: {
    color: COLORS.onSurface,
    fontSize: 24,
    fontWeight: "700",
  },
  content: {
    flexGrow: 0,
  },
  contentInner: {
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  profileHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
  },
  avatarText: {
    color: "#fff",
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontWeight: "800",
  },
  profileHeadText: {
    flex: 1,
    minWidth: 0,
  },
  displayName: {
    color: COLORS.onSurface,
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: "800",
  },
  metaText: {
    color: COLORS.onSurfaceVariant,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: 4,
  },
  section: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    gap: SPACING.md,
  },
  sectionTitle: {
    color: COLORS.onSurface,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: "800",
  },
  grid: {
    gap: SPACING.md,
  },
  field: {
    gap: SPACING.xs,
  },
  label: {
    color: COLORS.onSurface,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: "700",
  },
  input: {
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: COLORS.outlineVariant,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    backgroundColor: "#fff",
    color: COLORS.onSurface,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  disabledButton: {
    opacity: 0.6,
  },
  footer: {
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.outlineVariant,
  },
  logoutButton: {
    minHeight: 48,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.error,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutText: {
    color: COLORS.error,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: "800",
  },
});

export default UserProfileModal;
