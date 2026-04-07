import { z } from 'zod';

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  mobilePhone: z.string().min(7).max(40).optional(),
  smsOptIn: z.boolean().optional(),
  role: z.enum(['seller', 'agent', 'provider']).optional(),
  attribution: z
    .object({
      anonymousId: z.string().min(1).optional(),
      platform: z.string().min(1).optional(),
      source: z.string().min(1).optional(),
      medium: z.string().min(1).optional(),
      campaign: z.string().min(1).optional(),
      adset: z.string().min(1).optional(),
      ad: z.string().min(1).optional(),
      route: z.string().min(1).optional(),
      landingPath: z.string().min(1).optional(),
      referrer: z.string().min(1).optional(),
      roleIntent: z.string().min(1).optional(),
    })
    .optional(),
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
  attribution: z
    .object({
      anonymousId: z.string().min(1).optional(),
      platform: z.string().min(1).optional(),
      source: z.string().min(1).optional(),
      medium: z.string().min(1).optional(),
      campaign: z.string().min(1).optional(),
      adset: z.string().min(1).optional(),
      ad: z.string().min(1).optional(),
      route: z.string().min(1).optional(),
      landingPath: z.string().min(1).optional(),
      referrer: z.string().min(1).optional(),
      roleIntent: z.string().min(1).optional(),
      previewReadyScore: z.number().nonnegative().optional(),
      previewMidPrice: z.number().nonnegative().optional(),
    })
    .optional(),
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
