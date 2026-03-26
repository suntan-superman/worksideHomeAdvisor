# System Overview

## Active Architecture Choices

The original planning docs in this repository describe a TypeScript + Prisma + PostgreSQL baseline. The live scaffold now implemented in the repository uses these updated choices instead:

- `MongoDB Atlas` as the primary application database
- `Fastify` for the API layer
- `Next.js` in JavaScript for the seller web portal
- `Expo-managed React Native` for the mobile app
- `Email/password + OTP verification` for seller authentication

## Why MongoDB Fits This Product

MongoDB gives us a strong early-stage fit for:

- flexible storage of AI snapshots and analysis payloads
- rapid iteration on property, room, and media metadata
- easier ingestion of comp data with mixed provider payloads
- a smoother transition from the existing JavaScript-based AI backend patterns

## Service Boundaries

- `apps/api` owns auth, users, properties, tasks, documents, and workflow triggers
- `services/ai-orchestrator` owns prompt construction and structured workflow responses
- `services/media-worker` owns media processing and photo intelligence
- `services/market-data-worker` owns comps provider normalization and scoring
- `services/document-worker` owns flyer/document export jobs
- `services/notification-worker` owns OTP email delivery and reminders

## Auth Flow

1. Seller signs up with email and password.
2. API stores the account in MongoDB and generates an email OTP.
3. Seller enters the OTP to verify the email address.
4. API issues a JWT session token after successful verification.

## Current External Data Strategy

Comparable sales are now planned around `RentCast` as the primary market-data source. The current scaffold keeps a fallback demo path for local development when no API key is configured, but the provider layer is intentionally being shaped for RentCast-first comps retrieval and pricing context.
