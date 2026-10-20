import { z } from 'zod';

export const goalCreateSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(500).default(''),
});

export const goalUpdateSchema = z
  .object({
    title: z.string().trim().min(3).max(120).optional(),
    description: z.string().trim().max(500).optional(),
    status: z.enum(['active', 'completed', 'archived']).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required.');

export const sessionCreateSchema = z.object({
  goalId: z.uuid().nullable().optional(),
  goalTitle: z.string().trim().min(3).max(120),
  title: z.string().trim().min(3).max(160).default('Practice session'),
  categories: z.array(z.string().trim().min(1).max(80)).min(1).max(8),
  skillFocus: z.literal('all-skills').default('all-skills'),
  topic: z.string().trim().max(500).default(''),
});

export const responseCreateSchema = z.object({
  prompt: z.string().trim().min(3).max(1000),
  durationSeconds: z.number().int().min(0).max(3600),
  sequenceNumber: z.number().int().min(1).max(100),
});

export const analyzeResponseSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(200),
});

export const feedbackRatingSchema = z.object({
  rating: z.enum(['helpful', 'unhelpful']),
  note: z.string().trim().max(1000).nullable().optional(),
  dismissed: z.boolean().optional(),
});

export const finishSessionSchema = z.object({
  title: z.string().trim().min(3).max(160).optional(),
});

export const exerciseResponseSchema = z.object({
  answerText: z.string().trim().min(3).max(3000),
});
