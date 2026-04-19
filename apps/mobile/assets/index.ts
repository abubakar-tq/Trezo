/**
 * Centralized Asset Management
 * Export all assets from this single file to maintain consistency
 * and make asset management easier across the application.
 */

// App Icons and Logo
export const APP_ICON = require('./images/icon.png');
export const SPLASH_ICON = require('./images/splash-icon.png');
export const SPLASH_LOGO = require('./images/splash.jpg');
export const FAVICON = require('./images/favicon.png');

// Android Icons
export const ANDROID_ICON_BACKGROUND = require('./images/android-icon-background.png');
export const ANDROID_ICON_FOREGROUND = require('./images/android-icon-foreground.png');
export const ANDROID_ICON_MONOCHROME = require('./images/android-icon-monochrome.png');

// React Logo Assets
export const REACT_LOGO = require('./images/react-logo.png');
export const PARTIAL_REACT_LOGO = require('./images/partial-react-logo.png');

// Asset Categories for easy access
export const IMAGES = {
  app: {
    icon: APP_ICON,
    splashIcon: SPLASH_ICON,
    splashLogo: SPLASH_LOGO,
    favicon: FAVICON,
  },
  android: {
    background: ANDROID_ICON_BACKGROUND,
    foreground: ANDROID_ICON_FOREGROUND,
    monochrome: ANDROID_ICON_MONOCHROME,
  },
  react: {
    logo: REACT_LOGO,
    partial: PARTIAL_REACT_LOGO,
  },
};

// Export default for easy importing
export default IMAGES;