import { signupSchema, verifyOtpSchema } from '@workside/validation';
import { z } from 'zod';

import {
  enforceAuthAction,
  enforceScopedRateLimit,
} from '../usage/usage-enforcement.service.js';
import { verifySessionToken } from '../../services/sessionService.js';
import {
  deleteAccount,
  getAuthenticatedUser,
  login,
  requestForgotPasswordOtp,
  requestOtp,
  resetForgottenPassword,
  signup,
  updateAuthenticatedUser,
  verifyEmailOtp,
  verifyForgotPasswordOtp,
} from './auth.service.js';

const loginSchema = signupSchema.pick({
  email: true,
  password: true,
});

const requestOtpSchema = z.object({
  email: z.string().email(),
});

const resetPasswordVerifySchema = z.object({
  email: z.string().email(),
  otpCode: z.string().min(4).max(8),
});

const resetPasswordSchema = z
  .object({
    resetToken: z.string().min(20),
    newPassword: z.string().min(8).max(120),
    confirmPassword: z.string().min(8).max(120),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  mobilePhone: z.string().trim().max(40).optional(),
  smsOptIn: z.boolean().optional(),
});

function getSessionFromRequest(request) {
  const authorization = request.headers.authorization || '';
  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new Error('Authentication is required.');
  }

  return verifySessionToken(token);
}

async function enforceForgotPasswordRequestLimits(request, email) {
  const identifiers = [
    { key: email.toLowerCase(), scope: 'forgot-password:email', config: { max: 5, windowMs: 10 * 60 * 1000 } },
    { key: request.ip || 'unknown-ip', scope: 'forgot-password:ip', config: { max: 10, windowMs: 10 * 60 * 1000 } },
    {
      key: `${request.headers['user-agent'] || 'unknown-agent'}`.slice(0, 180),
      scope: 'forgot-password:device',
      config: { max: 8, windowMs: 10 * 60 * 1000 },
    },
  ];

  for (const entry of identifiers) {
    const decision = await enforceScopedRateLimit(entry.key, entry.scope, entry.config);
    if (!decision.allowed) {
      return decision;
    }
  }

  return { allowed: true };
}

export async function authRoutes(fastify) {
  fastify.post('/signup', async (request, reply) => {
    try {
      const payload = signupSchema.parse(request.body);
      const authDecision = await enforceAuthAction(payload.email.toLowerCase());
      if (!authDecision.allowed) {
        return reply
          .code(429)
          .header('Retry-After', String(authDecision.retryAfterSeconds))
          .send({ message: 'Too many auth/email actions. Please wait and try again.' });
      }
      const result = await signup(payload);
      return reply.code(201).send(result);
    } catch (error) {
      return reply.code(error.statusCode || 400).send({ message: error.message });
    }
  });

  fastify.post('/login', async (request, reply) => {
    try {
      const payload = loginSchema.parse(request.body);
      const authDecision = await enforceAuthAction(payload.email.toLowerCase());
      if (!authDecision.allowed) {
        return reply
          .code(429)
          .header('Retry-After', String(authDecision.retryAfterSeconds))
          .send({ message: 'Too many auth/email actions. Please wait and try again.' });
      }
      const result = await login(payload);
      return reply.send(result);
    } catch (error) {
      return reply.code(error.statusCode || 400).send({ message: error.message });
    }
  });

  fastify.post('/request-otp', async (request, reply) => {
    try {
      const payload = requestOtpSchema.parse(request.body);
      const authDecision = await enforceAuthAction(payload.email.toLowerCase());
      if (!authDecision.allowed) {
        return reply
          .code(429)
          .header('Retry-After', String(authDecision.retryAfterSeconds))
          .send({ message: 'Too many auth/email actions. Please wait and try again.' });
      }
      const result = await requestOtp(payload.email);
      return reply.send(result);
    } catch (error) {
      return reply.code(error.statusCode || 400).send({ message: error.message });
    }
  });

  fastify.post('/verify-email', async (request, reply) => {
    try {
      const payload = verifyOtpSchema.parse(request.body);
      const authDecision = await enforceAuthAction(payload.email.toLowerCase());
      if (!authDecision.allowed) {
        return reply
          .code(429)
          .header('Retry-After', String(authDecision.retryAfterSeconds))
          .send({ message: 'Too many auth/email actions. Please wait and try again.' });
      }
      const result = await verifyEmailOtp(payload);
      return reply.send(result);
    } catch (error) {
      return reply.code(error.statusCode || 400).send({ message: error.message });
    }
  });

  fastify.post('/forgot-password/request', async (request, reply) => {
    try {
      const payload = requestOtpSchema.parse(request.body);
      const rateLimit = await enforceForgotPasswordRequestLimits(request, payload.email);
      if (!rateLimit.allowed) {
        return reply
          .code(429)
          .header('Retry-After', String(rateLimit.retryAfterSeconds))
          .send({ message: 'Too many password reset attempts. Please wait and try again.' });
      }
      const result = await requestForgotPasswordOtp(payload.email);
      return reply.send(result);
    } catch (error) {
      return reply.code(error.statusCode || 400).send({ message: error.message });
    }
  });

  fastify.post('/forgot-password/verify', async (request, reply) => {
    try {
      const payload = resetPasswordVerifySchema.parse(request.body);
      const rateLimit = await enforceForgotPasswordRequestLimits(request, payload.email);
      if (!rateLimit.allowed) {
        return reply
          .code(429)
          .header('Retry-After', String(rateLimit.retryAfterSeconds))
          .send({ message: 'Too many password reset attempts. Please wait and try again.' });
      }
      const result = await verifyForgotPasswordOtp(payload);
      return reply.send(result);
    } catch (error) {
      return reply.code(error.statusCode || 400).send({ message: error.message });
    }
  });

  fastify.post('/forgot-password/reset', async (request, reply) => {
    try {
      const payload = resetPasswordSchema.parse(request.body);
      const result = await resetForgottenPassword(payload);
      return reply.send(result);
    } catch (error) {
      return reply.code(error.statusCode || 400).send({ message: error.message });
    }
  });

  fastify.get('/me', async (request, reply) => {
    try {
      const session = getSessionFromRequest(request);
      const user = await getAuthenticatedUser(session.sub);
      return reply.send({ user });
    } catch (error) {
      return reply.code(error.statusCode || 401).send({ message: error.message });
    }
  });

  fastify.patch('/profile', async (request, reply) => {
    try {
      const session = getSessionFromRequest(request);
      const payload = updateProfileSchema.parse(request.body || {});
      const user = await updateAuthenticatedUser(session.sub, payload);
      return reply.send({ user });
    } catch (error) {
      return reply.code(error.statusCode || 400).send({ message: error.message });
    }
  });

  fastify.delete('/account', async (request, reply) => {
    try {
      const session = getSessionFromRequest(request);
      const result = await deleteAccount(session.sub);
      return reply.send(result);
    } catch (error) {
      return reply.code(error.statusCode || 401).send({ message: error.message });
    }
  });
}
