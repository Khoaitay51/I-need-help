import React, { useState } from "react";
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import OutlineIcon from "./OutlineIcon";
import KMALogo from "./KMALogo";
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from "../theme";

const getInitials = (user) => {
  const name = user?.name || user?.username || "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length > 1) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name[0]?.toUpperCase() || "U";
};

const ChatSidebar = ({
  user,
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onRenameConversation,
  onProfilePress,
  onLogout,
}) => {
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");

  const confirmDelete = (conversation) => {
    Alert.alert("Xóa cuộc trò chuyện", "Bạn có chắc chắn muốn xóa cuộc trò chuyện này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: () => onDeleteConversation(conversation.id),
      },
    ]);
  };

  const startEdit = (conversation) => {
    setEditingId(conversation.id);
    setEditTitle(conversation.title || "");
  };

  const saveEdit = async () => {
    if (!editingId || !editTitle.trim()) {
      setEditingId(null);
      return;
    }
    await onRenameConversation(editingId, editTitle.trim());
    setEditingId(null);
    setEditTitle("");
  };

  return (
    <View style={styles.sidebar}>
      <View style={styles.header}>
        <View style={styles.brand}>
          <View style={styles.brandLogo}>
            <KMALogo size="small" showText={false} />
          </View>
          <View style={styles.brandText}>
            <Text style={styles.brandName}>ACTVN-AGENT</Text>
            <Text style={styles.brandSub} numberOfLines={1}>
              Học viện Kỹ thuật Mật mã
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.newButton} onPress={onNewConversation}>
          <OutlineIcon name="plus" size={17} color={COLORS.primary} />
          <Text style={styles.newButtonText}>Cuộc trò chuyện mới</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.listWrap}>
        <Text style={styles.sectionLabel}>Gần đây</Text>
        <FlatList
          data={conversations}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <View style={styles.emptyIconWrap}>
                <OutlineIcon name="message-square" size={24} color={COLORS.outline} />
              </View>
              <Text style={styles.emptyTitle}>Chưa có cuộc trò chuyện</Text>
              <Text style={styles.emptyText}>Nhấn nút ở trên để bắt đầu.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const active = currentConversationId === item.id;
            return (
              <TouchableOpacity
                style={[styles.item, active && styles.itemActive]}
                onPress={() => onSelectConversation(item)}
                activeOpacity={0.82}
              >
                <View style={[styles.itemIcon, active && styles.itemIconActive]}>
                  <OutlineIcon
                    name="message-square"
                    size={15}
                    color={active ? COLORS.primary : COLORS.onSurfaceVariant}
                  />
                </View>
                <View style={styles.itemContent}>
                  {editingId === item.id ? (
                    <TextInput
                      style={styles.editInput}
                      value={editTitle}
                      onChangeText={setEditTitle}
                      onBlur={saveEdit}
                      onSubmitEditing={saveEdit}
                      autoFocus
                    />
                  ) : (
                    <>
                      <Text
                        style={[styles.itemTitle, active && styles.itemTitleActive]}
                        numberOfLines={1}
                      >
                        {item.title || "Trò chuyện mới"}
                      </Text>
                      <Text style={styles.itemPreview} numberOfLines={1}>
                        {item.preview ||
                          (item.updated_at
                            ? new Date(item.updated_at).toLocaleDateString("vi-VN")
                            : "Sẵn sàng tiếp tục")}
                      </Text>
                    </>
                  )}
                </View>
                <View style={styles.itemActions}>
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => startEdit(item)}
                  >
                    <OutlineIcon name="edit-3" size={14} color={COLORS.onSurfaceVariant} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => confirmDelete(item)}
                  >
                    <OutlineIcon name="trash-2" size={14} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <View style={styles.footer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(user)}</Text>
        </View>
        <View style={styles.userText}>
          <Text style={styles.userName} numberOfLines={1}>
            {user?.name || user?.username || "Người dùng"}
          </Text>
          <Text style={styles.userMeta} numberOfLines={1}>
            {user?.studentCode || user?.email || "Active"}
          </Text>
        </View>
        <TouchableOpacity style={styles.footerButton} onPress={onProfilePress}>
          <OutlineIcon name="user" size={16} color={COLORS.onSurfaceVariant} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerButton} onPress={onLogout}>
          <OutlineIcon name="log-out" size={16} color={COLORS.error} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sidebar: {
    flex: 1,
    backgroundColor: COLORS.surfaceSecondary,
    borderRightWidth: 1,
    borderRightColor: COLORS.outlineVariant,
  },
  header: {
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outlineVariant,
    gap: SPACING.lg,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  brandLogo: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    backgroundColor: "#fff",
  },
  brandText: {
    flex: 1,
    minWidth: 0,
  },
  brandName: {
    color: COLORS.onSurface,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: "800",
  },
  brandSub: {
    color: COLORS.onSurfaceVariant,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
  },
  newButton: {
    minHeight: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary20,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
  },
  newButtonText: {
    color: COLORS.primary,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: "800",
  },
  listWrap: {
    flex: 1,
    paddingTop: SPACING.md,
  },
  sectionLabel: {
    color: COLORS.outline,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: "800",
    textTransform: "uppercase",
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  listContent: {
    paddingHorizontal: SPACING.sm,
    paddingBottom: SPACING.lg,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: "transparent",
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.xs,
    gap: SPACING.sm,
  },
  itemActive: {
    borderColor: COLORS.primary20,
    backgroundColor: COLORS.primary50,
  },
  itemIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  itemIconActive: {
    borderColor: COLORS.primary20,
  },
  itemContent: {
    flex: 1,
    minWidth: 0,
  },
  itemTitle: {
    color: COLORS.onSurface,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: "700",
  },
  itemTitleActive: {
    color: COLORS.primary,
  },
  itemPreview: {
    color: COLORS.onSurfaceVariant,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 3,
  },
  itemActions: {
    flexDirection: "row",
    gap: SPACING.xs,
  },
  iconButton: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  editInput: {
    minHeight: 34,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: SPACING.sm,
    color: COLORS.onSurface,
    backgroundColor: "#fff",
  },
  emptyBox: {
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING["3xl"],
  },
  emptyIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    color: COLORS.onSurface,
    fontWeight: "800",
  },
  emptyText: {
    color: COLORS.onSurfaceVariant,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: SPACING.xs,
    textAlign: "center",
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: COLORS.outlineVariant,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primary20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  avatarText: {
    color: COLORS.primary,
    fontWeight: "800",
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  userText: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    color: COLORS.onSurface,
    fontWeight: "800",
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  userMeta: {
    color: COLORS.onSurfaceVariant,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
  },
  footerButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
});

export default ChatSidebar;
