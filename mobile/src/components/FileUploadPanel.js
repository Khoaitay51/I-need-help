import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import { chatApi } from "../api";
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from "../theme";
import OutlineIcon from "./OutlineIcon";

const allowedTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
];

const FileUploadPanel = ({ onFilesSelected, onClose }) => {
  const [activeTab, setActiveTab] = useState("upload");
  const [selectedLocalFiles, setSelectedLocalFiles] = useState([]);
  const [savedFiles, setSavedFiles] = useState([]);
  const [selectedSavedIds, setSelectedSavedIds] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  useEffect(() => {
    if (activeTab === "saved") {
      loadSavedFiles();
    }
  }, [activeTab]);

  const loadSavedFiles = async () => {
    setLoadingSaved(true);
    const response = await chatApi.listFiles();
    setLoadingSaved(false);

    if (response.success) {
      setSavedFiles(response.data || []);
    } else {
      Alert.alert("Lỗi", response.error || "Không thể tải tài liệu đã lưu");
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: allowedTypes,
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (!result.canceled && result.assets?.length) {
        const files = result.assets.map((asset) => ({
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || "application/octet-stream",
          size: asset.size || 0,
        }));
        setSelectedLocalFiles((prev) => [...prev, ...files]);
      }
    } catch (error) {
      Alert.alert("Lỗi", "Không thể chọn file");
    }
  };

  const toggleSavedFile = (fileId) => {
    setSelectedSavedIds((prev) =>
      prev.includes(fileId)
        ? prev.filter((id) => id !== fileId)
        : [...prev, fileId],
    );
  };

  const handleDeleteSavedFile = (file) => {
    Alert.alert("Xóa tài liệu", `Bạn có chắc chắn muốn xóa "${file.name}"?`, [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          const response = await chatApi.deleteFile(file.file_id);
          if (response.success) {
            setSavedFiles((prev) =>
              prev.filter((item) => item.file_id !== file.file_id),
            );
            setSelectedSavedIds((prev) =>
              prev.filter((id) => id !== file.file_id),
            );
          } else {
            Alert.alert("Lỗi", response.error || "Không thể xóa tài liệu");
          }
        },
      },
    ]);
  };

  const handleConfirm = () => {
    const savedSelections = savedFiles
      .filter((file) => selectedSavedIds.includes(file.file_id))
      .map((file) => ({
        file_id: file.file_id,
        name: file.name,
        filename: file.filename,
        size: file.size,
        status: file.status,
      }));

    const selectedFiles = [...selectedLocalFiles, ...savedSelections];

    if (selectedFiles.length === 0) {
      Alert.alert("Thông báo", "Vui lòng chọn ít nhất một tài liệu");
      return;
    }

    onFilesSelected(selectedFiles);
  };

  const removeLocalFile = (index) => {
    setSelectedLocalFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const selectedCount = selectedLocalFiles.length + selectedSavedIds.length;

  return (
    <SafeAreaView style={styles.overlay}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Đính kèm tài liệu</Text>
            <Text style={styles.subtitle}>Tải file mới hoặc chọn tài liệu đã lưu</Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <OutlineIcon name="x" size={22} color={COLORS.onSurface} />
          </TouchableOpacity>
        </View>

        <View style={styles.tabs}>
          <TabButton
            label="Tải lên"
            active={activeTab === "upload"}
            onPress={() => setActiveTab("upload")}
          />
          <TabButton
            label="Đã lưu"
            active={activeTab === "saved"}
            onPress={() => setActiveTab("saved")}
          />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {activeTab === "upload" ? (
            <>
              <TouchableOpacity style={styles.uploadZone} onPress={handlePickDocument}>
                <View style={styles.uploadIcon}>
                  <OutlineIcon name="upload-cloud" size={28} color={COLORS.primary} />
                </View>
                <Text style={styles.uploadTitle}>Chọn file từ thiết bị</Text>
                <Text style={styles.uploadText}>
                  PDF, Word, Excel, ảnh, Markdown hoặc TXT
                </Text>
              </TouchableOpacity>

              {selectedLocalFiles.length > 0 && (
                <View style={styles.filesSection}>
                  <Text style={styles.sectionTitle}>
                    Đã chọn ({selectedLocalFiles.length})
                  </Text>
                  {selectedLocalFiles.map((file, index) => (
                    <FileRow
                      key={`${file.name}-${index}`}
                      file={file}
                      selected
                      onPress={() => removeLocalFile(index)}
                      actionIcon="trash-2"
                    />
                  ))}
                </View>
              )}
            </>
          ) : (
            <View style={styles.filesSection}>
              <View style={styles.savedHeader}>
                <Text style={styles.sectionTitle}>Tài liệu đã upload</Text>
                <TouchableOpacity style={styles.refreshButton} onPress={loadSavedFiles}>
                  <OutlineIcon name="upload-cloud" size={15} color={COLORS.primary} />
                  <Text style={styles.refreshText}>Tải lại</Text>
                </TouchableOpacity>
              </View>

              {loadingSaved ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator color={COLORS.primary} />
                  <Text style={styles.loadingText}>Đang tải tài liệu...</Text>
                </View>
              ) : savedFiles.length === 0 ? (
                <View style={styles.emptyBox}>
                  <OutlineIcon name="message-square" size={24} color={COLORS.outline} />
                  <Text style={styles.emptyTitle}>Chưa có tài liệu đã upload</Text>
                  <Text style={styles.emptyText}>
                    Tài liệu bạn gửi kèm câu hỏi sẽ xuất hiện ở đây.
                  </Text>
                </View>
              ) : (
                savedFiles.map((file) => {
                  const selected = selectedSavedIds.includes(file.file_id);
                  return (
                    <FileRow
                      key={file.file_id}
                      file={file}
                      selected={selected}
                      onPress={() => toggleSavedFile(file.file_id)}
                      onDelete={() => handleDeleteSavedFile(file)}
                      actionIcon={selected ? "check" : "plus"}
                    />
                  );
                })
              )}
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
            <Text style={styles.secondaryText}>Hủy</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryButton, selectedCount === 0 && styles.disabledButton]}
            onPress={handleConfirm}
            disabled={selectedCount === 0}
          >
            <OutlineIcon name="check" size={17} color="#fff" />
            <Text style={styles.primaryText}>Dùng tài liệu ({selectedCount})</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const TabButton = ({ label, active, onPress }) => (
  <TouchableOpacity
    style={[styles.tabButton, active && styles.tabButtonActive]}
    onPress={onPress}
  >
    <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
  </TouchableOpacity>
);

const FileRow = ({ file, selected, onPress, onDelete, actionIcon }) => (
  <TouchableOpacity
    style={[styles.fileItem, selected && styles.fileItemSelected]}
    onPress={onPress}
    activeOpacity={0.82}
  >
    <View style={styles.fileIcon}>
      <Text style={styles.fileIconText}>{getFileExt(file.name || file.filename)}</Text>
    </View>
    <View style={styles.fileText}>
      <Text style={styles.fileName} numberOfLines={1}>
        {file.name || file.filename}
      </Text>
      <Text style={styles.fileSize}>
        {formatFileSize(file.size)} · {formatStatus(file.status)}
      </Text>
    </View>
    {onDelete && (
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={(event) => {
          event.stopPropagation?.();
          onDelete();
        }}
      >
        <OutlineIcon name="trash-2" size={15} color={COLORS.error} />
      </TouchableOpacity>
    )}
    <View style={[styles.selectButton, selected && styles.selectButtonActive]}>
      <OutlineIcon
        name={actionIcon}
        size={15}
        color={selected ? "#fff" : COLORS.primary}
      />
    </View>
  </TouchableOpacity>
);

const getFileExt = (name = "") => {
  const ext = name.split(".").pop()?.slice(0, 4).toUpperCase();
  return ext && ext !== name.toUpperCase() ? ext : "FILE";
};

const formatFileSize = (bytes = 0) => {
  if (!bytes) return "Không rõ dung lượng";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const formatStatus = (status) => {
  if (status === "ready") return "Sẵn sàng";
  if (status === "processing") return "Đang xử lý";
  if (status === "failed") return "Lỗi xử lý";
  return status || "Sẵn sàng";
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15,20,25,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "88%",
    backgroundColor: COLORS.surfaceSecondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    backgroundColor: "#fff",
  },
  tabs: {
    flexDirection: "row",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    backgroundColor: COLORS.surfaceSecondary,
  },
  tabButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  tabButtonActive: {
    borderColor: COLORS.primary20,
    backgroundColor: COLORS.primary50,
  },
  tabText: {
    color: COLORS.onSurfaceVariant,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: "800",
  },
  tabTextActive: {
    color: COLORS.primary,
  },
  content: {
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  uploadZone: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: COLORS.primary20,
    borderRadius: RADIUS.lg,
    backgroundColor: "#fff",
    alignItems: "center",
    paddingVertical: SPACING["4xl"],
    paddingHorizontal: SPACING.lg,
  },
  uploadIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.primary20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary50,
    marginBottom: SPACING.md,
  },
  uploadTitle: {
    color: COLORS.onSurface,
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: "800",
    marginBottom: SPACING.xs,
  },
  uploadText: {
    color: COLORS.onSurfaceVariant,
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: "center",
  },
  filesSection: {
    gap: SPACING.sm,
  },
  savedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.xs,
  },
  sectionTitle: {
    color: COLORS.onSurface,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: "800",
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.primary20,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    backgroundColor: "#fff",
  },
  refreshText: {
    color: COLORS.primary,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: "800",
  },
  fileItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    borderRadius: RADIUS.md,
    backgroundColor: "#fff",
    padding: SPACING.md,
  },
  fileItemSelected: {
    borderColor: COLORS.primary20,
    backgroundColor: COLORS.primary50,
  },
  fileIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  fileIconText: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: "900",
  },
  fileText: {
    flex: 1,
    minWidth: 0,
  },
  fileName: {
    color: COLORS.onSurface,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: "800",
  },
  fileSize: {
    color: COLORS.onSurfaceVariant,
    fontSize: TYPOGRAPHY.fontSize.xs,
    marginTop: 3,
  },
  deleteButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  selectButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.primary20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  selectButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  loadingBox: {
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING["3xl"],
  },
  loadingText: {
    color: COLORS.onSurfaceVariant,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  emptyBox: {
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING["3xl"],
  },
  emptyTitle: {
    color: COLORS.onSurface,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: "800",
  },
  emptyText: {
    color: COLORS.onSurfaceVariant,
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: "center",
    lineHeight: 20,
  },
  footer: {
    flexDirection: "row",
    gap: SPACING.md,
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.outlineVariant,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.outlineVariant,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  secondaryText: {
    color: COLORS.onSurface,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: "800",
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: SPACING.sm,
  },
  primaryText: {
    color: "#fff",
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: "800",
  },
  disabledButton: {
    opacity: 0.55,
  },
});

export default FileUploadPanel;
