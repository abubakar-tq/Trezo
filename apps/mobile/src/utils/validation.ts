/**
 * Common form validation utilities
 * Provides reusable validation functions for forms across the app
 */

// Email validation
export const EMAIL_REGEX = /[^\s@]+@[^\s@]+\.[^\s@]+/;

export const isValidEmail = (email: string): boolean => {
  const trimmed = email.trim();
  return EMAIL_REGEX.test(trimmed);
};

export const maskEmail = (email: string): string => {
  const [user, domain] = email.split("@");
  if (!user || !domain) return email;
  const maskedUser = user.length > 3 ? `${user.slice(0, 3)}...` : `${user.slice(0, 1)}**`;
  return `${maskedUser}@${domain}`;
};

// Username validation
export const MIN_USERNAME_LENGTH = 3;
export const MAX_USERNAME_LENGTH = 30;

export const isValidUsername = (username: string): boolean => {
  const trimmed = username.trim();
  return trimmed.length >= MIN_USERNAME_LENGTH && trimmed.length <= MAX_USERNAME_LENGTH;
};

export const getUsernameError = (username: string): string | null => {
  const trimmed = username.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length < MIN_USERNAME_LENGTH) {
    return `Username must be at least ${MIN_USERNAME_LENGTH} characters.`;
  }
  if (trimmed.length > MAX_USERNAME_LENGTH) {
    return `Username must be no more than ${MAX_USERNAME_LENGTH} characters.`;
  }
  return null;
};

// OTP validation
export const OTP_LENGTH = 6;

export const isValidOTP = (otp: string): boolean => {
  return /^\d{6}$/.test(otp);
};

export const formatOTPArray = (otpArray: string[]): string => {
  return otpArray.join("");
};

export const isOTPDigit = (value: string): boolean => {
  return /^\d?$/.test(value);
};
