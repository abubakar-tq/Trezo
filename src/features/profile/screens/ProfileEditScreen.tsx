import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import {
    ThemedAlert,
    type ThemedAlertButton,
} from "@shared/components/ui/ThemedAlert";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import { useUserStore } from "@store/useUserStore";
import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";
import { StorageTest } from "@utils/StorageTest";
import { ProfileSyncService } from "../services/ProfileSyncService";

const ProfileEditScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { user, profile } = useUserStore();
  const baselineAvatarUrl =
    profile !== null
      ? (profile?.avatarUrl ?? null)
      : ((user?.user_metadata?.avatar_url as string | undefined) ?? null);

  const [username, setUsername] = useState(profile?.username || "");
  const [avatarUri, setAvatarUri] = useState<string | null>(baselineAvatarUrl);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    buttons?: ThemedAlertButton[];
  }>({ visible: false, title: "", message: "" });

  const showAlert = useCallback(
    (title: string, message: string, buttons?: ThemedAlertButton[]) => {
      setAlertConfig({ visible: true, title, message, buttons });
    },
    [],
  );

  const dismissAlert = useCallback(() => {
    setAlertConfig({ visible: false, title: "", message: "" });
  }, []);

  const handleUsernameChange = useCallback((text: string) => {
    setUsername(text);
    setHasChanges(true);
  }, []);

  const pickImage = useCallback(async () => {
    // Request permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== "granted") {
      showAlert(
        "Permission Required",
        "Please grant photo library access to change your profile picture.",
      );
      return;
    }

    // Launch image picker with validation options
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      // Note: Expo ImagePicker doesn't support file size limits directly
      // Validation will happen in the upload service
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];

      // LOGGING: Check what image-picker is actually returning
      console.log("📸 [ImagePicker] Asset Properties:", {
        uri: asset.uri,
        mimeType: asset.mimeType,
        type: (asset as any).type,
        fileName: asset.fileName,
        fileSize: asset.fileSize,
      });

      // Basic client-side validation - allow anything that starts with image/
      const mimeType = asset.mimeType;
      const type = asset.type;

      if (mimeType && !mimeType.startsWith("image/")) {
        showAlert(
          "Invalid File Type",
          `File type "${mimeType}" is not supported. Please select an image.`,
        );
        return;
      } else if (!mimeType && type && type !== "image") {
        showAlert("Invalid File Type", "Please select a valid image.");
        return;
      }

      // Check file size (2MB limit)
      if (asset.fileSize && asset.fileSize > 2 * 1024 * 1024) {
        const sizeMB = (asset.fileSize / (1024 * 1024)).toFixed(1);
        showAlert(
          "File Too Large",
          `Selected image is ${sizeMB}MB. Please choose an image smaller than 2MB.`,
        );
        return;
      }

      setAvatarUri(asset.uri);
      setHasChanges(true);
    }
  }, []);

  const takePhoto = useCallback(async () => {
    // Request camera permissions
    const { status } = await ImagePicker.requestCameraPermissionsAsync();

    if (status !== "granted") {
      showAlert(
        "Permission Required",
        "Please grant camera access to take a profile picture.",
      );
      return;
    }

    // Launch camera with validation options
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      // Note: Camera captures will be validated during upload
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];

      // Basic client-side validation - allow anything that starts with image/
      const mimeType = asset.mimeType;
      const type = asset.type;

      if (mimeType && !mimeType.startsWith("image/")) {
        showAlert(
          "Invalid File Type",
          `File type "${mimeType}" is not supported. Please capture an image.`,
        );
        return;
      } else if (!mimeType && type && type !== "image") {
        showAlert("Invalid File Type", "Please capture a valid image.");
        return;
      }

      // Check file size (if available from camera)
      if (asset.fileSize && asset.fileSize > 2 * 1024 * 1024) {
        // 2MB
        const sizeMB = (asset.fileSize / (1024 * 1024)).toFixed(1);
        showAlert(
          "File Too Large",
          `Captured image is ${sizeMB}MB. Please try again with a smaller image.`,
        );
        return;
      }

      setAvatarUri(asset.uri);
      setHasChanges(true);
    }
  }, []);

  const removeAvatar = useCallback(() => {
    showAlert(
      "Remove Profile Picture",
      "Are you sure you want to remove your profile picture?",
      [
        { text: "Cancel", style: "cancel", onPress: dismissAlert },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            if (!user?.id) {
              dismissAlert();
              showAlert("Error", "User not authenticated");
              return;
            }

            // If no persisted avatar exists, only clear local preview state.
            if (!baselineAvatarUrl) {
              dismissAlert();
              setAvatarUri(null);
              setHasChanges(username.trim() !== (profile?.username || ""));
              return;
            }

            try {
              setIsSaving(true);
              setIsUploading(true);

              const success = await ProfileSyncService.removeAvatar(user.id);

              // Dismiss the confirmation alert
              dismissAlert();

              if (!success) {
                showAlert(
                  "Error",
                  "Failed to remove avatar from database. Please try again.",
                );
                setIsSaving(false);
                setIsUploading(false);
                return;
              }

              // Success: stay on the screen but clear local state
              setAvatarUri(null);
              setHasChanges(username.trim() !== (profile?.username || ""));
              setIsSaving(false);
              setIsUploading(false);

              // No need to go back, the UI will reflect the removed avatar
            } catch (error) {
              console.error("Failed to remove avatar:", error);
              dismissAlert();
              showAlert(
                "Error",
                `Failed to remove avatar: ${error instanceof Error ? error.message : "Unknown error"}`,
              );
              setIsSaving(false);
              setIsUploading(false);
            }
          },
        },
      ],
    );
  }, [
    baselineAvatarUrl,
    profile?.username,
    showAlert,
    dismissAlert,
    user?.id,
    username,
    navigation,
  ]);

  const showImageOptions = useCallback(() => {
    const options: ThemedAlertButton[] = [
      { text: "Take Photo", onPress: takePhoto, style: "default" },
      { text: "Choose from Library", onPress: pickImage, style: "default" },
      ...(avatarUri
        ? [
            {
              text: "Remove Picture",
              onPress: removeAvatar,
              style: "destructive" as const,
            },
          ]
        : []),
      { text: "Cancel", style: "cancel" as const, onPress: () => {} },
    ];

    showAlert("Profile Picture", "Choose an option", options);
  }, [avatarUri, pickImage, removeAvatar, takePhoto]);

  const handleSave = useCallback(async () => {
    if (!user?.id) {
      showAlert("Error", "User not authenticated");
      return;
    }

    if (!username.trim()) {
      showAlert("Invalid Input", "Please enter a username");
      return;
    }

    setIsSaving(true);

    try {
      // Update username if changed
      if (username.trim() !== profile?.username) {
        const result = await ProfileSyncService.updateUsername(
          user.id,
          username.trim(),
        );
        if (!result.success) {
          showAlert(
            "Username Error",
            result.error || "Failed to update username",
          );
          setIsSaving(false);
          return;
        }
      }

      // Handle avatar changes
      const currentAvatarUrl = baselineAvatarUrl;
      const isNewAvatar = avatarUri && avatarUri !== currentAvatarUrl;
      const isRemovedAvatar = !avatarUri && currentAvatarUrl;

      if (isNewAvatar) {
        // Test storage access first
        console.log("🧪 Testing storage access before upload...");
        const storageTest = await StorageTest.testStorageAccess();
        console.log("📊 Storage test result:", storageTest);

        if (!storageTest.canList) {
          showAlert(
            "Storage Error",
            "Cannot access storage bucket. Please check your connection and try again.\\n\\n" +
              `Error: ${storageTest.error || "Unknown error"}`,
          );
          setIsSaving(false);
          return;
        }

        // Upload new avatar
        setIsUploading(true);
        const result = await ProfileSyncService.updateAvatar(
          user.id,
          avatarUri!,
        );
        setIsUploading(false);

        if (!result.success) {
          showAlert(
            "Avatar Upload Error",
            result.error || "Failed to upload avatar",
          );
          setIsSaving(false);
          return;
        }
      } else if (isRemovedAvatar) {
        // Remove avatar
        const success = await ProfileSyncService.removeAvatar(user.id);
        if (!success) {
          showAlert("Error", "Failed to remove avatar");
          setIsSaving(false);
          return;
        }
      }

      setHasChanges(false);
      showAlert("Success", "Profile updated successfully!", [
        { text: "OK", onPress: () => navigation.goBack(), style: "default" },
      ]);
    } catch (error) {
      console.error("Failed to save profile:", error);
      showAlert("Error", "An unexpected error occurred. Please try again.");
    } finally {
      setIsSaving(false);
      setIsUploading(false);
    }
  }, [user?.id, username, avatarUri, baselineAvatarUrl, profile, navigation]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={!hasChanges || isSaving}
          style={styles.saveButton}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={colors.accentAlt} />
          ) : (
            <Text
              style={[
                styles.saveButtonText,
                (!hasChanges || isSaving) && styles.saveButtonTextDisabled,
              ]}
            >
              Save
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            onPress={showImageOptions}
            style={styles.avatarContainer}
            activeOpacity={0.85}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Feather name="user" size={48} color={colors.textMuted} />
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              <Feather name="camera" size={16} color="#ffffff" />
            </View>
          </TouchableOpacity>

          {isUploading && (
            <View style={styles.uploadingIndicator}>
              <ActivityIndicator size="small" color={colors.accentAlt} />
              <Text style={styles.uploadingText}>Updating...</Text>
            </View>
          )}
        </View>

        {/* Username Input */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={handleUsernameChange}
            placeholder="Enter your username"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={30}
          />
          <Text style={styles.inputHint}>
            This is how others will see you in the app
          </Text>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Feather name="info" size={16} color={colors.accentAlt} />
            <Text style={styles.infoText}>
              Your profile is synced across all your devices
            </Text>
          </View>
        </View>
      </ScrollView>
      <ThemedAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onDismiss={dismissAlert}
      />
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderMuted,
    },
    headerTitle: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: "700",
    },
    saveButton: {
      minWidth: 60,
      alignItems: "flex-end",
    },
    saveButtonText: {
      color: colors.accentAlt,
      fontSize: 16,
      fontWeight: "600",
    },
    saveButtonTextDisabled: {
      opacity: 0.4,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 40,
    },
    avatarSection: {
      alignItems: "center",
      marginVertical: 32,
    },
    avatarContainer: {
      position: "relative",
    },
    avatar: {
      width: 120,
      height: 120,
      borderRadius: 60,
      borderWidth: 3,
      borderColor: colors.border,
    },
    avatarPlaceholder: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: withAlpha(colors.textPrimary, 0.06),
      borderWidth: 2,
      borderColor: colors.borderMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarEditBadge: {
      position: "absolute",
      bottom: 0,
      right: 0,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.accentAlt,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 3,
      borderColor: colors.background,
    },
    uploadingIndicator: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 12,
    },
    uploadingText: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    inputSection: {
      marginBottom: 24,
    },
    inputLabel: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "600",
      marginBottom: 8,
    },
    input: {
      backgroundColor: colors.surfaceCard,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
      color: colors.textPrimary,
      fontSize: 16,
    },
    inputHint: {
      color: colors.textMuted,
      fontSize: 13,
      marginTop: 6,
    },
    infoCard: {
      backgroundColor: withAlpha(colors.accentAlt, 0.1),
      borderRadius: 16,
      padding: 16,
      marginTop: 8,
    },
    infoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    infoText: {
      color: colors.textSecondary,
      fontSize: 13,
      flex: 1,
      lineHeight: 18,
    },
  });

export default ProfileEditScreen;
