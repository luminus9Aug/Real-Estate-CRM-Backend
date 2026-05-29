import { z } from 'zod';
import { LeadSource, LeadStatus, SupportedLanguage } from '@prisma/client';

export const BaseLeadSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().min(1).max(20),
  email: z.string().email().optional().or(z.literal('')),
  alternatePhone: z.string().max(20).optional(),
  budgetMin: z.number().nonnegative().optional(),
  budgetMax: z.number().nonnegative().optional(),
  message: z.string().optional(),
  status: z.nativeEnum(LeadStatus).optional(),
  source: z.nativeEnum(LeadSource).optional(),
  preferredLanguage: z.nativeEnum(SupportedLanguage).optional(),
  preferredPropertyId: z.string().optional(),
});

const budgetRefinement = (data: { budgetMin?: number; budgetMax?: number }) => {
  if (data.budgetMin !== undefined && data.budgetMax !== undefined) {
    return data.budgetMax >= data.budgetMin;
  }
  return true;
};

export const CreateLeadSchema = BaseLeadSchema.refine(budgetRefinement, {
  message: "Maximum budget cannot be less than minimum budget",
  path: ["budgetMax"],
});

export const UpdateLeadSchema = BaseLeadSchema.partial().refine(budgetRefinement, {
  message: "Maximum budget cannot be less than minimum budget",
  path: ["budgetMax"],
});

export type CreateLeadType = z.infer<typeof CreateLeadSchema>;
export type UpdateLeadType = z.infer<typeof UpdateLeadSchema>;
