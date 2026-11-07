import { z } from 'zod';
import { PASSWORD_MAX_LENGTH } from '../domain/password-policy';

/** Strict objects: unknown keys are rejected (R-API-01). */
export const registerSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(254),
    password: z.string().max(PASSWORD_MAX_LENGTH),
    businessName: z.string().trim().min(1).max(160),
    /**
     * Click-through acceptance of the agreement (terms + data processing addendum). A business
     * cannot be activated without it (R-PRV-01), so it is required and the accepted version is
     * recorded in the audit log.
     */
    agreement: z
      .object({ accepted: z.literal(true), version: z.string().trim().min(1).max(40) })
      .strict(),
  })
  .strict();

export const loginSchema = z
  .object({
    email: z.string().trim().email().max(254),
    password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  })
  .strict();

export const verifyEmailSchema = z.object({ token: z.string().min(20).max(200) }).strict();

export const switchTenantSchema = z.object({ membershipId: z.string().uuid() }).strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
