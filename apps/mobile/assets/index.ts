/**
 * Centralized Asset Management
 * Export all assets from this single file to maintain consistency
 * and make asset management easier across the application.
 */

// App Icons and Logo
export const APP_ICON = require('./images/icon.png');
export const LOGO_NO_BACKGROUND = require('./images/icon_nobackground.png');
export const SPLASH_LOGO = require('./images/splash.jpg');
export const FAVICON = require('./images/favicon.png');

// Asset Categories for easy access
export const IMAGES = {
  app: {
    icon: APP_ICON,
    logoNoBackground: LOGO_NO_BACKGROUND,
    splashLogo: SPLASH_LOGO,
    favicon: FAVICON,
  },
};

// Export default for easy importing
export default IMAGES;