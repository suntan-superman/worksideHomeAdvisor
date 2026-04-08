import { signupSchema, verifyOtpSchema } from '@workside/validation';
import { z } from 'zod';

import { enforceAuthAction } from '../usage/usage-enforcement.service.js';
import { verifySessionToken } from '../../services/sessionService.js';
import { deleteAccount, login, requestOtp, signup, verifyEmailOtp } from './auth.service.js';

const loginSchema = signupSchema.pick({
  email: true,
  password: true,
});

const requestOtpSchema = z.object({
  email: z.string().email(),
});

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

  fastify.delete('/account', async (request, reply) => {
    try {
      const authorization = request.headers.authorization || '';
      const [scheme, token] = authorization.split(' ');

      if (scheme !== 'Bearer' || !token) {
        return reply.code(401).send({ message: 'Authentication is required.' });
      }

      const session = verifySessionToken(token);
      const result = await deleteAccount(session.sub);
      return reply.send(result);
    } catch (error) {
      return reply.code(error.statusCode || 401).send({ message: error.message });
    }
  });
}
