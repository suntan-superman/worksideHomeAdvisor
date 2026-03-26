export const FEATURE_FLAGS = {
  enableDocumentDrafting: true,
  enableFlyerExport: true,
  enableAdvancedPricing: true,
  enablePushNotifications: false,
  enableAdminPromptEditor: true,
  enableAdvertiserPlacements: false,
};

export const MARKET_DATA = {
  provider: 'rentcast',
  defaultRadiusMiles: 1.5,
  maxRadiusMiles: 5,
  defaultLookbackMonths: 6,
};

export const APP_ROUTES = {
  web: {
    home: '/',
    auth: '/auth',
    dashboard: '/dashboard',
  },
  api: {
    health: '/health',
    authSignup: '/api/v1/auth/signup',
    authVerifyEmail: '/api/v1/auth/verify-email',
    properties: '/api/v1/properties',
  },
};
