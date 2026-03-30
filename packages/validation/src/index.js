import { z } from 'zod';

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  role: z.enum(['seller', 'agent', 'provider']).optional(),
});

export const verifyOtpSchema = z.object({
  email: z.string().email(),
  otpCode: z.string().min(4).max(8),
});

export const propertySchema = z.object({
  title: z.string().min(1),
  addressLine1: z.string().min(3),
  city: z.string().min(2),
  state: z.string().min(2).max(2),
  zip: z.string().min(5),
  propertyType: z.string().min(1),
  bedrooms: z.number().nonnegative().optional(),
  bathrooms: z.number().nonnegative().optional(),
  squareFeet: z.number().int().positive().optional(),
});

export const aiRequestSchema = z.object({
  propertyId: z.string().min(1),
  workflow: z.enum(['pricing', 'improvements', 'marketing', 'documents', 'timing']),
  payload: z.record(z.any()).default({}),
});

export const photoAnalysisSchema = z.object({
  roomLabel: z.string().min(1).max(80),
  mimeType: z.string().min(1),
  imageBase64: z.string().min(100),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  assetId: z.string().optional(),
});
