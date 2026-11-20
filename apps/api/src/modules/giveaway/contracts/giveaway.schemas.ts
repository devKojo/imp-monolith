import { z } from 'zod';

/** Request shapes (R-API-02: validate every input at the edge; unknown keys are rejected). */

const slug = z
  .string()
  .max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
export const slugParamSchema = z.object({ slug }).strict();
