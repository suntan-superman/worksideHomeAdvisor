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

  process.env.EXPO_PUBLIC_API_URL = apiUrl;

  return {
    ...appJson.expo,
    extra: {
      ...(appJson.expo.extra || {}),
      apiUrl,
    },
  };
};
