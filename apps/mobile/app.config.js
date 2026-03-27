import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import appJson from './app.json' with { type: 'json' };

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

export default () => ({
  ...appJson.expo,
  extra: {
    ...(appJson.expo.extra || {}),
    apiUrl,
  },
});
