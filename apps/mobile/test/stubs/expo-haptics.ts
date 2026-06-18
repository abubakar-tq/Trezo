/**
 * Test stub for `expo-haptics`.
 * Haptic feedback is device-only; stub as no-ops for Node tests.
 */
export const impactAsync = async () => {};
export const notificationAsync = async () => {};
export const selectionAsync = async () => {};
export const ImpactFeedbackStyle = { Light: "light", Medium: "medium", Heavy: "heavy" };
export const NotificationFeedbackType = { Success: "success", Warning: "warning", Error: "error" };
export default { impactAsync, notificationAsync, selectionAsync, ImpactFeedbackStyle, NotificationFeedbackType };
