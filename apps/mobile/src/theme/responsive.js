import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const BASE_WIDTH = 393;
const BASE_HEIGHT = 852;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function rw(value) {
  return Math.round((SCREEN_WIDTH / BASE_WIDTH) * value);
}

export function rh(value) {
  return Math.round((SCREEN_HEIGHT / BASE_HEIGHT) * value);
}

export function rf(value, options = {}) {
  const minimum = options.minimum ?? value * 0.88;
  const maximum = options.maximum ?? value * 1.18;
  return Math.round(clamp((SCREEN_WIDTH / BASE_WIDTH) * value, minimum, maximum));
}

export const spacing = {
  xxs: rw(6),
  xs: rw(10),
  sm: rw(14),
  md: rw(18),
  lg: rw(22),
  xl: rw(28),
  xxl: rw(36),
};

export const radius = {
  sm: rw(14),
  md: rw(18),
  lg: rw(22),
  xl: rw(28),
  round: 999,
};

export const typography = {
  eyebrow: rf(12, { minimum: 11, maximum: 13 }),
  caption: rf(13, { minimum: 12, maximum: 14 }),
  body: rf(15, { minimum: 14, maximum: 16 }),
  bodyLarge: rf(17, { minimum: 16, maximum: 18 }),
  title: rf(22, { minimum: 20, maximum: 24 }),
  headline: rf(32, { minimum: 26, maximum: 34 }),
};

export const device = {
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  isCompactHeight: SCREEN_HEIGHT < 720,
  isSmallWidth: SCREEN_WIDTH < 380,
};
