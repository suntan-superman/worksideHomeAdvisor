const fs = require('node:fs');
const path = require('node:path');

const appJson = require('./app.json');

function readEnvFile(filename) {
  const filePath = path.join(__dirname, filename);
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const values = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    values[key] = value;
  }

  return values;
}

module.exports = () => {
  const localEnv = {
    ...readEnvFile('.env'),
    ...readEnvFile('.env.local'),
  };

  const apiUrl =
    localEnv.EXPO_PUBLIC_API_URL ||
    process.env.EXPO_PUBLIC_API_URL ||
    appJson.expo.extra?.apiUrl ||
    'http://localhost:4000';

  const configuredWebUrl =
    localEnv.EXPO_PUBLIC_WEB_URL ||
    process.env.EXPO_PUBLIC_WEB_URL ||
    localEnv.MOBILE_PUBLIC_WEB_URL ||
    process.env.MOBILE_PUBLIC_WEB_URL ||
    localEnv.PUBLIC_WEB_URL ||
    process.env.PUBLIC_WEB_URL ||
    appJson.expo.extra?.webUrl ||
    'https://worksidehomeadvisor.netlify.app';

  const webUrl =
    configuredWebUrl.startsWith('http://localhost') || configuredWebUrl.startsWith('https://localhost')
      ? appJson.expo.extra?.webUrl || 'https://worksidehomeadvisor.netlify.app'
      : configuredWebUrl;

  const supportEmail =
    localEnv.PUBLIC_SUPPORT_EMAIL ||
    process.env.PUBLIC_SUPPORT_EMAIL ||
    appJson.expo.extra?.supportEmail ||
    'support@worksidesoftware.com';

  process.env.EXPO_PUBLIC_API_URL = apiUrl;

  return {
    ...appJson.expo,
    plugins: [...new Set([...(appJson.expo.plugins || []), 'expo-secure-store'])],
    extra: {
      ...(appJson.expo.extra || {}),
      apiUrl,
      webUrl,
      supportEmail,
    },
  };
};
