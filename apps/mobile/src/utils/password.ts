export const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?`~]{8,}$/;

export const isStrongPassword = (value: string): boolean => STRONG_PASSWORD_REGEX.test(value);

export const suggestPasswordRules =
  "Use at least 8 characters with uppercase, lowercase, and a number.";
