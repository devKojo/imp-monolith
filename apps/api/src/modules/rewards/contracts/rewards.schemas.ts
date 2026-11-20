import { z } from 'zod';
import { uuidSchema } from '@/shared/uuid';

/** Request shapes (R-API-02: validate every input at the edge; unknown keys are rejected). */

export const campaignParamSchema = z.object({ campaignId: uuidSchema }).strict();
export const drawParamSchema = z.object({ drawId: uuidSchema }).strict();
