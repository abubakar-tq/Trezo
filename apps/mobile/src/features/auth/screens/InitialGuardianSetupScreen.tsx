/**
 * InitialGuardianSetupScreen.tsx
 * Final step of onboarding: Add first trusted contact
 */

import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";

import AuthScaffold from '@features/auth/components/AuthScaffold';
import { Onboarding3 } from '@/assets/components';

interface InitialGuardianSetupScreenProps {
  onAdd?: (email: string) => void;
  onSkip?: () => void;
  onFinish?: () => void;
}

export const InitialGuardianSetupScreen: React.FC<InitialGuardianSetupScreenProps> = ({
  onAdd,
  onSkip,
  onFinish,
}) => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [email, setEmail] = useState('');
  const [addedContacts, setAddedContacts] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  const handleAddContact = async () => {
    if (!email.trim()) return;

    setIsAdding(true);
    // Simulate adding contact (1.5 seconds)
    setTimeout(() => {
      setAddedContacts([...addedContacts, email]);
      setEmail('');
      setIsAdding(false);
      onAdd?.(email);
    }, 1500);
  };

  const handleRemoveContact = (contactEmail: string) => {
    setAddedContacts(addedContacts.filter((c) => c !== contactEmail));
  };

  return (
    <AuthScaffold
      title="Add Backup Plan"
      subtitle="Add trusted people who can help you recover your account if you're locked out."
      icon={<Onboarding3 />}
      footer={
        <View style={styles.actionGroup}>
           <TouchableOpacity
            onPress={() => {
              if (addedContacts.length > 0) {
                onFinish?.();
              } else {
                onSkip?.();
              }
            }}
            activeOpacity={0.85}
            style={[styles.primaryButton, { backgroundColor: colors.accent }]}
          >
            <Text style={styles.primaryButtonText}>{addedContacts.length > 0 ? 'FINISH SETUP' : 'CONTINUE'}</Text>
          </TouchableOpacity>

          {addedContacts.length === 0 && (
            <TouchableOpacity onPress={onSkip} style={styles.skipButton}>
              <Text style={styles.skipText}>Skip for now</Text>
            </TouchableOpacity>
          )}
        </View>
      }
    >
      <View style={styles.container}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email Address or Phone</Text>
          <TextInput
            placeholder="contact@example.com"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            editable={!isAdding}
            style={styles.input}
          />
          <TouchableOpacity
            onPress={handleAddContact}
            disabled={isAdding || !email.trim()}
            activeOpacity={0.85}
            style={[
              styles.addButton, 
              { backgroundColor: (isAdding || !email.trim()) ? colors.glass : colors.glassBorder }
            ]}
          >
            <Text style={[styles.addButtonText, { color: (isAdding || !email.trim()) ? `${colors.textPrimary}4D` : colors.textPrimary }]}>
              {isAdding ? 'ADDING...' : 'ADD CONTACT'}
            </Text>
          </TouchableOpacity>
        </View>

        {addedContacts.length > 0 && (
          <View style={styles.listContainer}>
            <Text style={styles.sectionHeader}>ADDED CONTACTS</Text>
            {addedContacts.map((contact, idx) => (
              <View key={idx} style={styles.contactRow}>
                <View style={styles.contactInfo}>
                   <View style={styles.invitedTag}><Text style={styles.invitedText}>INVITED</Text></View>
                   <Text style={styles.contactEmail}>{contact}</Text>
                </View>
                <TouchableOpacity onPress={() => handleRemoveContact(contact)}>
                  <Text style={styles.removeIcon}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>
    </AuthScaffold>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    gap: 24,
  },
  inputGroup: {
    gap: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: `${colors.textPrimary}80`,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: colors.glass,
    borderRadius: 16,
    padding: 16,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    fontSize: 16,
  },
  addButton: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1,
  },
  listContainer: {
    gap: 12,
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.accentAlt,
    letterSpacing: 2,
  },
  contactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.glass,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  invitedTag: {
    backgroundColor: `${colors.accentAlt}1A`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  invitedText: {
    fontSize: 8,
    fontWeight: '900',
    color: colors.accentAlt,
  },
  contactEmail: {
    color: colors.textPrimary,
    fontWeight: "600",
    fontSize: 14,
  },
  removeIcon: {
    color: `${colors.textPrimary}4D`,
    fontWeight: "900",
  },
  actionGroup: {
    gap: 16,
  },
  primaryButton: {
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: "center",
    shadowColor: colors.accentAlt,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  primaryButtonText: {
    color: colors.textOnAccent,
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 2,
  },
  skipButton: {
    alignItems: "center",
  },
  skipText: {
    color: `${colors.textPrimary}66`,
    fontSize: 14,
    fontWeight: "700",
  },
});

export default InitialGuardianSetupScreen;
