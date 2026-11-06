import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const userIdParamSchema = z.object({ id: z.string().uuid() });

export interface User extends CreateUserInput {
  id: string;
  createdAt: string;
}

/** Event contract published by this module. */
export const USER_CREATED = 'users.created';
export const userCreatedSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
});
export type UserCreatedPayload = z.infer<typeof userCreatedSchema>;
