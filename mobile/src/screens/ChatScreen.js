import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import OutlineIcon from "../components/OutlineIcon";
import { chatApi, modelApi } from "../api";
import ChatHeaderBar from "../components/ChatHeaderBar";
import ChatSidebar from "../components/ChatSidebar";
import FileUploadPanel from "../components/FileUploadPanel";
import MessageBubble from "../components/MessageBubble";
import UserProfileModal from "../components/UserProfileModal";
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from "../theme";

const SUGGESTED_QUESTIONS = [
  "Điều kiện tốt nghiệp của sinh viên là gì?",
  "Cách tính điểm trung bình tích lũy?",
  "Quy định đăng ký học phần như thế nào?",
  "Thủ tục xin nghỉ học cần giấy tờ gì?",
];

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 11) return "Chào buổi sáng";
  if (hour < 14) return "Chào buổi trưa";
  if (hour < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
};

const ChatScreen = ({ user, onLogout }) => {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isWide = width >= 820;
  const flatListRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [fileUploadVisible, setFileUploadVisible] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [userProfileVisible, setUserProfileVisible] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [currentUser, setCurrentUser] = useState(user);
  const [activeModel, setActiveModel] = useState(null);
  const [chatMode, setChatMode] = useState("document");
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const canUseStudentMode = Boolean(currentUser?.studentCode);

  useEffect(() => {
    loadConversations();
    loadActiveModel();

    const modelTimer = setInterval(loadActiveModel, 10000);
    return () => clearInterval(modelTimer);
  }, []);

  useEffect(() => {
    if (!canUseStudentMode && chatMode === "student") {
      setChatMode("document");
    }
    if (chatMode === "student") {
      setSelectedFiles([]);
    }
  }, [canUseStudentMode, chatMode]);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates?.height || 0);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 80);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const loadConversations = async () => {
    const response = await chatApi.getConversations();
    if (response.success) {
      setConversations(response.data || []);
    }
  };

  const loadActiveModel = async () => {
    const response = await modelApi.getActiveModel();
    if (response.success) {
      setActiveModel(response.data);
    }
  };

  const handleSelectConversation = async (conversation) => {
    setConversationId(conversation.id);
    setSidebarVisible(false);
    setMessages([]);

    const response = await chatApi.getMessages(conversation.id);
    if (response.success) {
      setMessages(response.data || []);
    } else {
      Alert.alert("Lỗi", response.error || "Không thể tải tin nhắn");
    }
  };

  const handleNewConversation = () => {
    setConversationId(null);
    setMessages([]);
    setSelectedFiles([]);
    setSidebarVisible(false);
  };

  const handleRenameConversation = async (id, title) => {
    const response = await chatApi.renameConversation(id, title);
    if (response.success) {
      setConversations((prev) =>
        prev.map((item) => (item.id === id ? { ...item, title } : item)),
      );
    } else {
      Alert.alert("Lỗi", response.error || "Không thể đổi tên");
    }
  };

  const handleDeleteConversation = async (id) => {
    const response = await chatApi.deleteConversation(id);
    if (response.success) {
      setConversations((prev) => prev.filter((conv) => conv.id !== id));
      if (conversationId === id) {
        handleNewConversation();
      }
    } else {
      Alert.alert("Lỗi", response.error || "Không thể xóa cuộc trò chuyện");
    }
  };

  const handleSendMessage = async () => {
    if (loading || (!inputText.trim() && selectedFiles.length === 0)) return;

    const content = inputText.trim() || "Hãy phân tích file đã đính kèm.";
    const pendingFiles = selectedFiles;
    const userMessageId = `local-${Date.now()}`;

    setInputText("");
    setSelectedFiles([]);
    setLoading(true);
    setMessages((prev) => [
      ...prev,
      {
        id: userMessageId,
        role: "user",
        content,
        files: pendingFiles,
        timestamp: new Date().toISOString(),
      },
    ]);

    try {
      const response = await chatApi.sendMessage({
        content,
        conversation_id: conversationId,
        user_id: currentUser.id,
        files: pendingFiles,
        chat_mode: chatMode,
      });

      if (!response.success) {
        throw new Error(response.error || "Gửi tin nhắn thất bại");
      }

      if (!conversationId && response.conversation_id) {
        setConversationId(response.conversation_id);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: response.data.id || `assistant-${Date.now()}`,
          role: "assistant",
          content: response.data.content,
          attachments: response.data.attachments,
          timestamp: response.data.timestamp || new Date().toISOString(),
        },
      ]);
      loadConversations();
    } catch (error) {
      Alert.alert("Lỗi", error.message || "Lỗi kết nối");
      setSelectedFiles(pendingFiles);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionPress = (question) => {
    setInputText(question);
  };

  const sidebar = (
    <ChatSidebar
      user={currentUser}
      conversations={conversations}
      currentConversationId={conversationId}
      onSelectConversation={handleSelectConversation}
      onNewConversation={handleNewConversation}
      onDeleteConversation={handleDeleteConversation}
      onRenameConversation={handleRenameConversation}
      onProfilePress={() => {
        setSidebarVisible(false);
        setUserProfileVisible(true);
      }}
      onLogout={onLogout}
    />
  );
  const displayName = currentUser?.name || currentUser?.username || "bạn";

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <View style={styles.layout}>
          {isWide && <View style={styles.sidebarPane}>{sidebar}</View>}

          <View style={styles.chatPane}>
            <ChatHeaderBar
              user={currentUser}
              activeModel={activeModel}
              onMenuPress={() => setSidebarVisible(true)}
              onProfilePress={() => setUserProfileVisible(true)}
              onLogout={onLogout}
            />

            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <MessageBubble message={item} user={currentUser} />
              )}
              contentContainerStyle={[
                styles.messagesList,
                messages.length === 0 && styles.emptyMessagesList,
              ]}
              ListEmptyComponent={
                <View style={styles.welcome}>
                  <View style={styles.welcomeIcon}>
                    <OutlineIcon name="message-circle" size={28} color={COLORS.primary} />
                  </View>
                  <Text style={styles.welcomeTitle}>
                    {getGreeting()}, {displayName}
                  </Text>
                  <Text style={styles.welcomeText}>
                    Tôi có thể giúp bạn tìm hiểu thông tin về Học viện Kỹ thuật Mật mã. Hãy hỏi bất cứ điều gì bạn muốn biết!
                  </Text>
                  <View style={styles.suggestionGrid}>
                    {SUGGESTED_QUESTIONS.map((question) => (
                      <TouchableOpacity
                        key={question}
                        style={styles.suggestionChip}
                        onPress={() => handleSuggestionPress(question)}
                        activeOpacity={0.82}
                      >
                        <Text style={styles.suggestionText}>{question}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              }
              ListFooterComponent={
                loading ? (
                  <View style={styles.typingRow}>
                    <View style={styles.thinkingLogoFrame}>
                      <Image
                        source={require("../../assets/kma.png")}
                        style={styles.thinkingLogo}
                        resizeMode="contain"
                      />
                    </View>
                    <View style={styles.thinkingTextBlock}>
                      <Text style={styles.typingText}>
                        ACTVN-AGENT đang xử lý...
                      </Text>
                      <Text style={styles.typingModel} numberOfLines={1}>
                        {activeModel?.name
                          ? `Model: ${activeModel.name}`
                          : "Đang đồng bộ model hệ thống"}
                      </Text>
                    </View>
                    <ActivityIndicator color={COLORS.primary} size="small" />
                  </View>
                ) : null
              }
              onContentSizeChange={() =>
                flatListRef.current?.scrollToEnd({ animated: true })
              }
              keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
              keyboardShouldPersistTaps="handled"
            />

            <View
              style={[
                styles.composer,
                keyboardHeight > 0 && {
                  paddingBottom: Math.max(SPACING.md, insets.bottom),
                },
              ]}
            >
              <View style={styles.modeRow}>
                <TouchableOpacity
                  style={[
                    styles.modeChip,
                    chatMode === "document" && styles.modeChipActive,
                  ]}
                  onPress={() => setChatMode("document")}
                  disabled={loading}
                >
                  <OutlineIcon
                    name="book-open"
                    size={15}
                    color={chatMode === "document" ? COLORS.primary : COLORS.onSurfaceVariant}
                  />
                  <Text
                    style={[
                      styles.modeChipText,
                      chatMode === "document" && styles.modeChipTextActive,
                    ]}
                  >
                    Hỏi tài liệu
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modeChip,
                    chatMode === "student" && styles.modeChipActive,
                    !canUseStudentMode && styles.modeChipDisabled,
                  ]}
                  onPress={() => canUseStudentMode && setChatMode("student")}
                  disabled={loading || !canUseStudentMode}
                >
                  <OutlineIcon
                    name={canUseStudentMode ? "award" : "lock"}
                    size={15}
                    color={chatMode === "student" ? COLORS.primary : COLORS.onSurfaceVariant}
                  />
                  <Text
                    style={[
                      styles.modeChipText,
                      chatMode === "student" && styles.modeChipTextActive,
                    ]}
                  >
                    Hỏi điểm
                  </Text>
                </TouchableOpacity>
              </View>

              {selectedFiles.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.fileChipRow}
                >
                  {selectedFiles.map((file, index) => (
                    <View key={`${file.name}-${index}`} style={styles.fileChip}>
                      <OutlineIcon name="paperclip" size={13} color={COLORS.primary} />
                      <Text style={styles.fileChipText} numberOfLines={1}>
                        {file.name}
                      </Text>
                      <TouchableOpacity
                        style={styles.fileChipRemoveButton}
                        onPress={() =>
                          setSelectedFiles((prev) =>
                            prev.filter((_, i) => i !== index),
                          )
                        }
                      >
                        <OutlineIcon name="x" size={13} color={COLORS.primary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}

              <View style={styles.inputRow}>
                <TouchableOpacity
                  style={styles.attachButton}
                  onPress={() => setFileUploadVisible(true)}
                  disabled={loading || chatMode === "student"}
                >
                  <OutlineIcon name="paperclip" size={19} color={COLORS.primary} />
                </TouchableOpacity>

                <TextInput
                  style={styles.input}
                  placeholder="Nhập tin nhắn..."
                  placeholderTextColor={COLORS.outline}
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
                  editable={!loading}
                />

                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    (loading || (!inputText.trim() && selectedFiles.length === 0)) &&
                      styles.disabledButton,
                  ]}
                  onPress={handleSendMessage}
                  disabled={loading || (!inputText.trim() && selectedFiles.length === 0)}
                >
                  {loading ? (
                    <ActivityIndicator color={COLORS.primary} size="small" />
                  ) : (
                    <OutlineIcon name="send" size={18} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        <Modal
          visible={!isWide && sidebarVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setSidebarVisible(false)}
        >
          <View style={styles.drawerOverlay}>
            <TouchableOpacity
              style={styles.drawerBackdrop}
              onPress={() => setSidebarVisible(false)}
              activeOpacity={1}
            />
            <View style={styles.drawer}>{sidebar}</View>
          </View>
        </Modal>

        <Modal
          visible={fileUploadVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setFileUploadVisible(false)}
        >
          <FileUploadPanel
            onFilesSelected={(files) => {
              setSelectedFiles((prev) => [...prev, ...files]);
              setFileUploadVisible(false);
            }}
            onClose={() => setFileUploadVisible(false)}
          />
        </Modal>

        <Modal
          visible={userProfileVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setUserProfileVisible(false)}
        >
          <UserProfileModal
            user={currentUser}
            onUserUpdate={setCurrentUser}
            onClose={() => setUserProfileVisible(false)}
            onLogout={() => {
              setUserProfileVisible(false);
              onLogout();
            }}
          />
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  layout: {
    flex: 1,
    flexDirection: "row",
  },
  sidebarPane: {
    width: 320,
  },
  chatPane: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  messagesList: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    gap: SPACING.md,
  },
  emptyMessagesList: {
    flexGrow: 1,
    justifyContent: "center",
  },
  welcome: {
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
  },
  welcomeIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.primary20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary50,
    marginBottom: SPACING.lg,
  },
  welcomeTitle: {
    color: COLORS.onSurface,
    fontSize: 25,
    fontWeight: "800",
    marginBottom: SPACING.sm,
    textAlign: "center",
  },
  welcomeText: {
    color: COLORS.onSurfaceVariant,
    fontSize: TYPOGRAPHY.fontSize.base,
    textAlign: "center",
    lineHeight: 24,
  },
  suggestionGrid: {
    width: "100%",
    marginTop: SPACING["2xl"],
    gap: SPACING.sm,
  },
  suggestionChip: {
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: RADIUS.md,
    backgroundColor: "#fff",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  suggestionText: {
    color: COLORS.onSurface,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: "700",
    lineHeight: 20,
  },
  typingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
  },
  thinkingLogoFrame: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.primary20,
    backgroundColor: "#fff",
  },
  thinkingLogo: {
    width: 24,
    height: 24,
  },
  thinkingTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  typingText: {
    color: COLORS.onSurface,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: "700",
  },
  typingModel: {
    color: COLORS.onSurfaceVariant,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 2,
  },
  composer: {
    borderTopWidth: 1,
    borderTopColor: COLORS.outlineVariant,
    backgroundColor: COLORS.surfaceSecondary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  modeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  modeChip: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: RADIUS.full,
    backgroundColor: "#fff",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  modeChipActive: {
    borderColor: COLORS.primary20,
    backgroundColor: COLORS.primary50,
  },
  modeChipDisabled: {
    opacity: 0.48,
  },
  modeChipText: {
    color: COLORS.onSurfaceVariant,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: "800",
  },
  modeChipTextActive: {
    color: COLORS.primary,
  },
  fileChipRow: {
    gap: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  fileChip: {
    maxWidth: 240,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: COLORS.primary20,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  fileChipText: {
    color: COLORS.primary,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: "700",
    maxWidth: 170,
  },
  fileChipRemoveButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: SPACING.sm,
  },
  attachButton: {
    width: 46,
    height: 46,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 46,
    borderWidth: 1.5,
    borderColor: COLORS.outlineVariant,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === "ios" ? 13 : 9,
    backgroundColor: "#fff",
    color: COLORS.onSurface,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: COLORS.primary20,
  },
  disabledButton: {
    opacity: 0.45,
  },
  drawerOverlay: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "rgba(15,20,25,0.35)",
  },
  drawerBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  drawer: {
    width: "86%",
    maxWidth: 340,
    height: "100%",
    backgroundColor: COLORS.surfaceSecondary,
  },
});

export default ChatScreen;
