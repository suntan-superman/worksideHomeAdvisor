import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';

export function signSessionToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN },
  );
}

export function verifySessionToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}
