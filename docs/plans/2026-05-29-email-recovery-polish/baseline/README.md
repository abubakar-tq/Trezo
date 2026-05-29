# Baseline screenshots

Capture these before any Phase 1–4 code is applied to a running simulator/device:

1. `email-recovery-screen.png` — `EmailRecoveryScreen` with module installed and guardians configured
2. `email-recovery-group-status-awaiting.png` — `EmailRecoveryGroupStatusScreen` with an active Recovery Attempt, phase = awaiting guardian reply
3. `email-recovery-group-status-ready.png` — same screen at phase = ready_to_execute (vote landed, delay elapsed)

To capture: run `npx expo start --simulator`, navigate to Profile → Email Recovery, start a Recovery Attempt, then use the iOS Simulator screenshot shortcut (Cmd+S) or Expo Go's screen capture.
