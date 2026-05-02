/**
 * InitialGuardianSetupScreen.tsx
 * Final step of onboarding: Add first trusted contact
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";
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
            placeholderTextColor="rgba(255,255,255,0.3)"
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
              { backgroundColor: (isAdding || !email.trim()) ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.1)" }
            ]}
          >
            <Text style={[styles.addButtonText, { color: (isAdding || !email.trim()) ? "rgba(255,255,255,0.3)" : "#FFF" }]}>
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

const styles = StyleSheet.create({
  container: {
    gap: 24,
  },
  inputGroup: {
    gap: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 16,
    color: "#FFF",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    fontSize: 16,
  },
  addButton: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
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
    color: "#00FFFF",
    letterSpacing: 2,
  },
  contactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  invitedTag: {
    backgroundColor: "rgba(0,255,255,0.1)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  invitedText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#00FFFF',
  },
  contactEmail: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 14,
  },
  removeIcon: {
    color: "rgba(255,255,255,0.3)",
    fontWeight: "900",
  },
  actionGroup: {
    gap: 16,
  },
  primaryButton: {
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: "center",
    shadowColor: "#00FFFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  primaryButtonText: {
    color: "#000",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 2,
  },
  skipButton: {
    alignItems: "center",
  },
  skipText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
    fontWeight: "700",
  },
});

export default InitialGuardianSetupScreen;
