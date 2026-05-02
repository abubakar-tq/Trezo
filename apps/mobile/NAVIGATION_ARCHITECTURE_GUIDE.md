---
name: Navigation Architecture & Developer Guide
date: 2026-04-26
version: 1.0
---

# Trezo Mobile: Navigation Architecture & Developer Guide

This guide documents the complete navigation structure, screen hierarchy, and component usage patterns for developers building features on top of the Trezo foundation.

---

## 1. Navigation Architecture Overview

### 1.1 Root Navigation Structure

```
AppNavigation (Entry Point)
├── AuthNavigation (Unauthenticated)
│   ├── WelcomeScreen
│   ├── PasskeyCreationScreen
│   ├── BiometricSetupScreen
│   ├── AccountCreatedScreen
│   └── InitialGuardianSetupScreen
│
└── DashboardScreen (Authenticated)
    ├── HomeTab
    │   ├── HomeScreen (F-Pattern layout)
    │   ├── QuickActionTray (3 buttons)
    │   └── WalletSummary (balance + trust)
    │
    ├── WalletTab → PortfolioScreen
    │   ├── Asset list (ETH, USDC, DAI, etc.)
    │   ├── Send/Receive quick actions
    │   └── [Send/Receive modals below]
    │       ├── SendScreen (lock icons, validation)
    │       ├── ReceiveScreen (QR code, copy)
    │       └── TransactionHistoryScreen (view-only)
    │
    ├── RecoveryTab → SecurityCenterScreen
    │   ├── Recovery Score widget (full breakdown)
    │   ├── Active Trusted Contacts (1 of 3)
    │   ├── Approval Requirement (2 out of 3)
    │   ├── Add Contact CTA
    │   ├── Guardian List Showcase (all 7 states)
    │   ├── Removed Contacts (audit trail)
    │   │
    │   └── [Sub-screens below]
    │       ├── GuardianManagementScreen (edit/remove)
    │       ├── AddGuardianScreen (email/phone invite)
    │       └── ThresholdConfigurationScreen (visual stepper)
    │
    ├── ContactsTab → ContactsScreen
    │   ├── Search bar
    │   ├── Filter tabs (All/Verified/Pending)
    │   ├── Contact list (avatar, name, status)
    │   └── Add New Contact button
    │
    └── SettingsTab → SettingsScreen
        ├── Security section (Biometric, Passkey, Export)
        ├── Notifications (toggles)
        ├── Appearance (Dark mode)
        ├── Support (Help, Report)
        ├── App Info (Version, Build)
        └── Logout button
```

---

## 2. Screen-by-Screen Navigation Reference

### 2.1 Auth Flow (5 screens)

```
┌─ WelcomeScreen
│  └─[Get Started]─→ PasskeyCreationScreen
│
├─ PasskeyCreationScreen (Step 1/3)
│  ├─[Continue]─→ BiometricSetupScreen
│  └─[Skip]─→ AccountCreatedScreen
│
├─ BiometricSetupScreen (Step 2/3)
│  ├─[Enable]─→ AccountCreatedScreen
│  └─[Skip]─→ AccountCreatedScreen
│
├─ AccountCreatedScreen (Step 3/3)
│  └─[Go to Dashboard]─→ DashboardScreen (Home tab)
│
└─ InitialGuardianSetupScreen (Alternative Step 3)
   ├─[Add Trusted Contact]─→ AddGuardianScreen
   └─[Skip]─→ DashboardScreen (Home tab)
```

**Entry Point**: `WelcomeScreen` (after authentication check)
**Exit Point**: `DashboardScreen` (when onboarding complete)

---

### 2.2 Dashboard Navigation (5 tabs)

```
DashboardScreen
├── 🏠 Home Tab (default)
│   └─ HomeScreen (F-Pattern: balance → actions → recovery score)
│
├── 💼 Wallet Tab
│   └─ PortfolioScreen
│      ├─[Send]─→ SendScreen (modal)
│      ├─[Receive]─→ ReceiveScreen (modal)
│      └─[History]─→ TransactionHistoryScreen (view-only)
│
├── 🛡 Recovery Tab
│   └─ SecurityCenterScreen
│      ├─[Manage Guardians]─→ GuardianManagementScreen
│      ├─[Configure Threshold]─→ ThresholdConfigurationScreen
│      ├─[Add Contact]─→ AddGuardianScreen
│      └─ GuardianListShowcase (QA section, non-interactive)
│
├── 👥 Contacts Tab
│   └─ ContactsScreen
│      ├─[Search/Filter]─→ Local filter
│      └─[Add New Contact]─→ AddContactModal (future)
│
└── ⚙️ Settings Tab
    └─ SettingsScreen
       ├─[Toggle Biometric]─→ Local state update
       ├─[Change Passkey]─→ BiometricUpdateFlow (future)
       ├─[Export Account]─→ ExportFlow (future)
       ├─[Help & FAQ]─→ WebView (future)
       ├─[Report Issue]─→ EmailFlow (future)
       ├─[Dark Mode]─→ ThemeUpdate
       └─[Logout]─→ AuthNavigation
```

**Key**: Tabs are persistent; navigation is tab-based, not stack-based
**Modals**: Send/Receive open as modal overlays (non-navigating)
**Sub-screens**: Recovery management screens navigate within the Recovery tab

---

### 2.3 Transaction Flow Detail

```
PortfolioScreen
├─[Send Button]─→ SendScreen (modal)
│  ├─ Input: Recipient address
│  ├─ Input: Amount (with Max button)
│  ├─ Validate: Address format, balance check
│  ├─ Display: Gas estimate, total
│  └─[Review & Send]─→ Confirmation (future)
│
└─[Receive Button]─→ ReceiveScreen (modal)
   ├─ Display: QR code (placeholder)
   ├─ Display: Wallet address (monospace)
   ├─[Copy Address]─→ Clipboard + toast "Copied"
   ├─[Share]─→ Native share sheet
   └─[Close]─→ Return to Portfolio
```

**Pattern**: Modal screens don't push to stack; they overlay current view
**Dismissal**: Close button or back gesture returns to calling screen
**Data Flow**: Callbacks (onSend, onReceive) trigger parent updates

---

### 2.4 Recovery Management Flow

```
SecurityCenterScreen
├─ Display: Recovery Score (4/10 items)
├─ Display: 1 of 3 Trusted Contacts (badge)
├─ Display: 2 out of 3 Approval Requirement
├─ Display: All 7 Guardian States (QA showcase)
├─ Display: Removed Contacts (audit trail, collapsible)
│
├─[Manage Guardians]─→ GuardianManagementScreen
│  ├─ List: Active contacts (with Edit/Remove)
│  ├─ List: All 7 guardian states (QA reference)
│  ├─ List: Removed contacts (audit trail)
│  └─[+ Add Trusted Contact]─→ AddGuardianScreen
│
├─[Configure Threshold]─→ ThresholdConfigurationScreen
│  ├─ Display: Visual fractionation (blocks)
│  ├─ Stepper: − [2] +
│  ├─ Warning: "You need 1 more contact for 3 approvals"
│  ├─ Explain: Security implications
│  └─[Save Configuration]─→ Update + close
│
└─[Add Another Contact]─→ AddGuardianScreen
   ├─ Input: Email or Phone (toggle)
   ├─ Display: Benefits section
   ├─ Display: How-it-works steps
   └─[Send Invite]─→ Invitation sent + close
```

**Pattern**: Recovery screens form a sub-graph within the Recovery tab
**State**: Changes persist (no stacking back)
**QA Feature**: GuardianListShowcase renders all 7 states for testing

---

## 3. Component Usage Patterns

### 3.1 Form Screens (SendScreen, AddGuardianScreen, ThresholdConfiguration)

```typescript
// Pattern for form screens with validation

const FormScreen = () => {
  const [formData, setFormData] = useState({...});
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = () => {
    if (!formData.field) {
      setError('Field is required');
      return false;
    }
    setError('');
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setIsSubmitting(true);
    // Simulate submission (1-2 seconds)
    setTimeout(() => {
      onSubmit(formData);
      setIsSubmitting(false);
    }, 1500);
  };

  return (
    <ScrollView>
      {/* Critical data top (Z-Pattern top) */}
      <Surface>
        <CriticalDataDisplay />
      </Surface>

      {/* Form inputs middle */}
      <CardLevel1>
        <Input label="Field" ... />
      </CardLevel1>

      {/* Error display */}
      {error && <ErrorBanner message={error} />}

      {/* Supplemental info */}
      <Surface>
        <InfoSection />
      </Surface>

      {/* Primary action bottom (Rule of One) */}
      <PrimaryButton
        label="Submit"
        onPress={handleSubmit}
        isLoading={isSubmitting}
        disabled={isSubmitting || !formData.field}
      />
      <SecondaryButton label="Cancel" onPress={onCancel} />
    </ScrollView>
  );
};
```

**Constraints**:

- Error state displays inline (no alert modals)
- Loading state via button spinner (not screen overlay)
- Submit button disabled until valid
- Cancel button always available

### 3.2 List Screens (ContactsScreen, TransactionHistoryScreen)

```typescript
// Pattern for list screens with filtering/search

const ListScreen = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const filteredItems = items.filter(item =>
    item.name.includes(searchQuery) &&
    (filter === 'all' || item.status === filter)
  );

  return (
    <ScrollView>
      {/* Header */}
      <HeadlineText>Title</HeadlineText>

      {/* Search/Filter controls */}
      <Input placeholder="Search..." onChange={setSearchQuery} />
      <FilterTabs value={filter} onChange={setFilter} />

      {/* Conditional empty state */}
      {filteredItems.length === 0 ? (
        <EmptyState message="..." cta="Add new" />
      ) : (
        <View>
          {/* Results count */}
          <CaptionText>{filteredItems.length} results</CaptionText>

          {/* Item list */}
          {filteredItems.map(item => (
            <CardLevel1 key={item.id}>
              <ItemCard item={item} />
            </CardLevel1>
          ))}
        </View>
      )}

      {/* Primary action (Rule of One) */}
      <PrimaryButton label="Add New" onPress={onAdd} />
    </ScrollView>
  );
};
```

**Constraints**:

- Empty state always provides CTA (never just "No results")
- Search/filter controlled locally (no async)
- Results count shown above list
- Add button always available at bottom

### 3.3 Display Screens (PortfolioScreen, SettingsScreen)

```typescript
// Pattern for view-only/settings screens

const DisplayScreen = () => {
  return (
    <ScrollView>
      {/* Header with optional summary */}
      <Surface>
        <CriticalDataSummary />
      </Surface>

      {/* Content sections (grouped) */}
      <View>
        <CaptionText>SECTION 1</CaptionText>
        {/* Items in this section */}
      </View>

      <View>
        <CaptionText>SECTION 2</CaptionText>
        {/* Items in this section */}
      </View>

      {/* Optional: Primary action or CTA */}
      <PrimaryButton label="Primary Action" onPress={onAction} />

      {/* Optional: Secondary actions */}
      <SecondaryButton label="Secondary" onPress={onSecondary} />
    </ScrollView>
  );
};
```

**Constraints**:

- Critical data always at top
- Sections grouped by CaptionText labels
- Information hierarchy respected (no mixed content types)
- Actions at bottom

---

## 4. State Management Patterns

### 4.1 Tab Navigation State

```typescript
// DashboardScreen manages tab state
const [activeTab, setActiveTab] = useState<TabType>('home');

// Pass through Tab-specific routes
{activeTab === 'wallet' && (
  <PortfolioScreen
    isDark={isDark}
    onSend={() => {/* Navigate to SendScreen */}}
    onReceive={() => {/* Navigate to ReceiveScreen */}}
  />
)}
```

**Pattern**: Tab state is top-level; children re-render on tab switch
**Persistence**: Tab state survives across app sessions (in prod, use Zustand store)

### 4.2 Modal Navigation Pattern

```typescript
// Send/Receive screens open as modals without pushing to stack
// They close by calling the callback

const SendScreen = ({ onSend, onCancel }) => {
  const handleSend = (recipient, amount) => {
    // Process
    onSend(recipient, amount); // Returns to parent
  };

  return (
    // Form ...
  );
};

// Parent usage
{showSendModal && (
  <SendScreen
    onSend={(recipient, amount) => {
      // Update state
      setShowSendModal(false);
      // Process transaction
    }}
    onCancel={() => setShowSendModal(false)}
  />
)}
```

**Pattern**: Modals don't use navigation stack; they use controlled visibility
**Callbacks**: Data flows back via onPress callbacks, not return values

### 4.3 Sub-graph Navigation (Recovery Tab)

```typescript
// Recovery tab manages its own sub-navigation
const [recoveryView, setRecoveryView] = useState<'center' | 'manage' | 'add' | 'threshold'>('center');

{activeTab === 'recovery' && recoveryView === 'center' && (
  <SecurityCenterScreen
    onManageGuardians={() => setRecoveryView('manage')}
    onAddContact={() => setRecoveryView('add')}
    onConfigureThreshold={() => setRecoveryView('threshold')}
  />
)}

{activeTab === 'recovery' && recoveryView === 'manage' && (
  <GuardianManagementScreen
    onBack={() => setRecoveryView('center')}
    onAddContact={() => setRecoveryView('add')}
  />
)}
```

**Pattern**: Tab contains a sub-state for screen switching
**Persistence**: Sub-screen state persists within tab session
**Back Navigation**: On-screen back button calls setState to return to parent

---

## 5. Component Import Patterns

### 5.1 Screens Import Pattern

```typescript
// In DashboardScreen.tsx (parent)
import { HomeScreen } from "./HomeScreen";
import { PortfolioScreen } from "../../wallet/screens/PortfolioScreen";
import { SecurityCenterScreen } from "../../recovery/screens/SecurityCenterScreen";
import { ContactsScreen } from "../../contacts/screens/ContactsScreen";
import { SettingsScreen } from "../../settings/screens/SettingsScreen";

// In feature screens (e.g., SendScreen.tsx)
import {
  PrimaryButton,
  SecondaryButton,
} from "../../../shared/components/Tier1/Button";
import { Input } from "../../../shared/components/Tier1/Input";
import { Surface, CardLevel1 } from "../../../shared/components/Tier1/Surface";
import { Colors, Spacing } from "../../../shared/components/TokenRegistry";
```

**Directory Convention**:

- Screens in: `apps/mobile/src/features/[feature]/screens/`
- Components in: `apps/mobile/src/shared/components/Tier[1-3]/`
- Tokens in: `apps/mobile/src/shared/components/TokenRegistry.ts`

### 5.2 Relative Path Patterns

```typescript
// From a screen: apps/mobile/src/features/wallet/screens/SendScreen.tsx
// To Tier1 components:
import { Button } from "../../../shared/components/Tier1/Button";
//                      ^^^ (up 3 levels: screens→wallet→features→src)

// From a component: apps/mobile/src/shared/components/Tier1/Button.tsx
// To TokenRegistry:
import { Colors, Spacing } from "../../TokenRegistry";
//                               ^^^ (up 1 level: Tier1→shared)

// From a component: apps/mobile/src/shared/components/Tier2/GuardianListItem.tsx
// To Tier1 components:
import { Text, Badge } from "../Tier1";
//                          ^^^ (sibling directory)
```

**Rule**: Always use relative paths from the current file
**Depth**: Calculate correctly with `../` (up directories)

---

## 6. Testing Checklist

### 6.1 Screen Testing Checklist

For each new screen, verify:

```
[ ] Layout
  [ ] Responsive on iPhone SE (375px) to iPhone 14 Pro (430px)
  [ ] Safe area insets respected (notch, home bar)
  [ ] ScrollView scrolls if content > viewport
  [ ] No content cutoff on smallest device

[ ] Typography
  [ ] Headline is largest, distinct
  [ ] Body text readable (16px baseline)
  [ ] Captions properly muted
  [ ] All text has isDark conditional coloring

[ ] Interactions
  [ ] All buttons press-responsive (opacity change)
  [ ] Forms validate before submit
  [ ] Error states display clearly
  [ ] Loading state shows spinner in button

[ ] Accessibility
  [ ] All interactive elements ≥ 44x44 pt
  [ ] Text contrast ≥ 4.5:1 on dark, ≥ 3:1 on light
  [ ] Screen reader labels present
  [ ] Keyboard navigation works (Tab key)

[ ] Visual Hierarchy
  [ ] Critical data is most prominent
  [ ] Actions grouped logically
  [ ] Trust markers deployed (shields, locks)
  [ ] Empty states provide CTAs

[ ] Constraints
  [ ] Rule of One: Only 1 primary button
  [ ] No technical terms (Guardian → Trusted Contact)
  [ ] No raw numbers (2 → "2 out of 3")
  [ ] Removed/deleted items never fully hidden
```

---

## 7. Common Patterns & Anti-Patterns

### ✅ Do This

```typescript
// Do: Use callback props for actions
<SendScreen
  onSend={(recipient, amount) => processTransaction(recipient, amount)}
  onCancel={() => closeModal()}
/>

// Do: Validate before submit
const handleSubmit = () => {
  if (!validateForm()) return;
  setIsSubmitting(true);
  // ...
};

// Do: Show errors inline, not in modals
{error && <ErrorBanner message={error} />}

// Do: Use TokenRegistry for all colors/spacing
<View style={{ marginBottom: Spacing.sp4, backgroundColor: Colors.background }} />

// Do: Make empty states helpful
<EmptyState
  icon="🛡"
  title="No recovery contacts yet"
  subtitle="Add a trusted contact to increase your security score"
  cta="Add Trusted Contact"
/>
```

### ❌ Don't Do This

```typescript
// Don't: Use Alert.alert for errors (blocks UI)
Alert.alert('Error', 'Something went wrong');

// Don't: Pass unvalidated data to callbacks
onSend(recipient, amount); // What if empty?

// Don't: Use hardcoded colors
<Text style={{ color: '#4f46e5' }} /> // Use Colors.primary

// Don't: Hide deleted items
// Instead: Show them in collapsible "Removed Contacts" section

// Don't: Use multiple primary buttons on one screen
<PrimaryButton label="Save" />
<PrimaryButton label="Reset" /> // ❌ Wrong! Use secondary button

// Don't: Display raw blockchain data
Display('TxHash: 0x123abc...'); // ❌ Confusing
Display('Transaction Receipt: 0x123abc...'); // ✅ Clear
```

---

## 8. Future Navigation Extensions

### 8.1 Planned Screens (Not Yet Built)

```
Future: Onboarding
├─ RecoveryPlannerScreen (guided setup)
├─ BiometricVerificationScreen (face/touch)
└─ BackupCodeDisplayScreen (12-word mnemonic)

Future: Transaction Management
├─ TransactionDetailScreen (full receipt)
├─ TransactionCancelScreen (pending cancellation)
└─ TransactionRetryScreen (failed retry)

Future: Recovery Flows
├─ AccountRecoveryInitiatorScreen (lost device)
├─ GuardianApprovalScreen (help someone recover)
└─ RecoveryCompletion Screen (access restored)

Future: Notifications
├─ NotificationDetailScreen (expand notification)
└─ NotificationHistoryScreen (archived)

Future: Contacts
├─ AddContactManuallyScreen (address entry)
├─ ImportContactsScreen (from device)
└─ ContactDetailScreen (edit/history)
```

### 8.2 Navigation Extension Pattern

When adding a new screen to an existing tab:

```typescript
// 1. Create screen file in appropriate feature
apps/mobile/src/features/[feature]/screens/[NewScreen].tsx

// 2. Export from index.ts
apps/mobile/src/features/[feature]/screens/index.ts

// 3. Import in parent screen (e.g., DashboardScreen)
import { NewScreen } from '../../[feature]/screens/NewScreen';

// 4. Add to state management
const [recoveryView, setRecoveryView] = useState<'...', 'newView'>('center');

// 5. Render conditionally
{activeTab === 'recovery' && recoveryView === 'newView' && (
  <NewScreen onBack={() => setRecoveryView('center')} />
)}

// 6. Add CTA from parent screen
<SecondaryButton
  label="New Action"
  onPress={() => setRecoveryView('newView')}
/>
```

---

## 9. Performance Optimization Checklist

For production deployment:

```
[ ] All screens render within 16.67ms (60 FPS target)
[ ] ScrollView items use keyExtractor for list efficiency
[ ] No inline function definitions (useMemo/useCallback)
[ ] Images optimized and cached
[ ] Unnecessary re-renders eliminated (React.memo)
[ ] Network requests debounced/throttled
[ ] Animations use native driver (if applicable)
```

---

**Document Version**: 1.0
**Last Updated**: April 26, 2026
**Next Update**: After Stage 6.1 (Advanced Features)
