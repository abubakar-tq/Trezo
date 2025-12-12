import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";

import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";
import { useUserStore } from "@store/useUserStore";
import { ProfileSyncService } from "../services/ProfileSyncService";
import { StorageTest } from "@utils/StorageTest";

const ProfileEditScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { user, profile, setProfile } = useUserStore();
  
  const [username, setUsername] = useState(profile?.username || "");
  const [avatarUri, setAvatarUri] = useState<string | null>(profile?.avatarUrl || null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handleUsernameChange = useCallback((text: string) => {
    setUsername(text);
    setHasChanges(true);
  }, []);

  const pickImage = useCallback(async () => {
    // Request permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please grant photo library access to change your profile picture."
      );
      return;
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
      setHasChanges(true);
    }
  }, []);

  const takePhoto = useCallback(async () => {
    // Request camera permissions
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please grant camera access to take a profile picture."
      );
      return;
    }

    // Launch camera
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
      setHasChanges(true);
    }
  }, []);

  const removeAvatar = useCallback(() => {
    Alert.alert(
      "Remove Profile Picture",
      "Are you sure you want to remove your profile picture?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            setAvatarUri(null);
            setHasChanges(true);
          },
        },
      ]
    );
  }, []);

  const showImageOptions = useCallback(() => {
    Alert.alert(
      "Profile Picture",
      "Choose an option",
      [
        { text: "Take Photo", onPress: takePhoto },
        { text: "Choose from Library", onPress: pickImage },
        ...(avatarUri ? [{ text: "Remove Picture", onPress: removeAvatar, style: "destructive" as const }] : []),
        { text: "Cancel", style: "cancel" },
      ]
    );
  }, [avatarUri, pickImage, removeAvatar, takePhoto]);

  const handleSave = useCallback(async () => {
    if (!user?.id) {
      Alert.alert("Error", "User not authenticated");
      return;
    }

    if (!username.trim()) {
      Alert.alert("Invalid Input", "Please enter a username");
      return;
    }

    setIsSaving(true);

    try {
      // Update username if changed
      if (username.trim() !== profile?.username) {
        const result = await ProfileSyncService.updateUsername(user.id, username.trim());
        if (!result.success) {
          Alert.alert("Username Error", result.error || "Failed to update username");
          setIsSaving(false);
          return;
        }
      }

      // Handle avatar changes
      const currentAvatarUrl = profile?.avatarUrl || null;
      const isNewAvatar = avatarUri && avatarUri !== currentAvatarUrl;
      const isRemovedAvatar = !avatarUri && currentAvatarUrl;

      if (isNewAvatar) {
        // Test storage access first
        console.log('🧪 Testing storage access before upload...');
        const storageTest = await StorageTest.testStorageAccess();
        console.log('📊 Storage test result:', storageTest);
        
        if (!storageTest.canList) {
          Alert.alert(
            "Storage Error", 
            "Cannot access storage bucket. Please check your connection and try again.\n\n" +
            `Error: ${storageTest.error || 'Unknown error'}`
          );
          setIsSaving(false);
          return;
        }

        // Upload new avatar
        setIsUploading(true);
        const result = await ProfileSyncService.updateAvatar(user.id, avatarUri!);
        setIsUploading(false);
        
        if (!result.success) {
          Alert.alert("Avatar Upload Error", result.error || "Failed to upload avatar");
          setIsSaving(false);
          return;
        }
      } else if (isRemovedAvatar) {
        // Remove avatar
        const success = await ProfileSyncService.removeAvatar(user.id);
        if (!success) {
          Alert.alert("Error", "Failed to remove avatar");
          setIsSaving(false);
          return;
        }
      }

      setHasChanges(false);
      Alert.alert("Success", "Profile updated successfully!", [
        { text: "OK", onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error("Failed to save profile:", error);
      Alert.alert("Error", "An unexpected error occurred. Please try again.");
    } finally {
      setIsSaving(false);
      setIsUploading(false);
    }
  }, [user?.id, username, avatarUri, profile, navigation]);

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
            <Text style={[
              styles.saveButtonText,
              (!hasChanges || isSaving) && styles.saveButtonTextDisabled
            ]}>
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
              <Text style={styles.uploadingText}>Uploading...</Text>
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
