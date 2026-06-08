import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import OutlineIcon from "./OutlineIcon";
import KMALogo from "./KMALogo";
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from "../theme";

const ChatHeaderBar = ({
  user,
  activeModel,
  onMenuPress,
  onProfilePress,
  onLogout,
}) => {
  const modelLabel = activeModel?.name
    ? `Model: ${activeModel.name}`
    : "Model: đang tải...";

  return (
    <View style={styles.header}>
      <View style={styles.row}>
        <TouchableOpacity
          onPress={onMenuPress}
          style={styles.iconButton}
          accessibilityLabel="Mở lịch sử trò chuyện"
        >
          <OutlineIcon name="menu" size={20} color={COLORS.onSurface} />
        </TouchableOpacity>

        <View style={styles.brand}>
          <View style={styles.logoFrame}>
            <KMALogo size="small" showText={false} />
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>ACTVN-AGENT</Text>
            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText} numberOfLines={1}>
                {modelLabel}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onProfilePress}
            accessibilityLabel="Thông tin người dùng"
          >
            <Text style={styles.profileInitial}>
              {(user?.name || user?.username || "U")[0]?.toUpperCase()}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onLogout}
            accessibilityLabel="Đăng xuất"
          >
            <OutlineIcon name="log-out" size={18} color={COLORS.error} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: COLORS.surfaceSecondary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outlineVariant,
  },
  row: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    gap: SPACING.md,
  },
  brand: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  logoFrame: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    backgroundColor: "#fff",
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: COLORS.onSurface,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: "800",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    marginTop: 2,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.success,
  },
  statusText: {
    color: COLORS.onSurfaceVariant,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    backgroundColor: "#fff",
  },
  profileInitial: {
    color: COLORS.primary,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: "800",
  },
});

export default ChatHeaderBar;
