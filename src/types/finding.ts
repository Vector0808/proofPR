import { z } from "zod";

export const FindingSeveritySchema = z.enum(["critical", "high", "medium", "low"]);
export const FindingTypeSchema = z.enum(["correctness", "regression", "validation", "error_handling", "security"]);

export const SuggestedReproductionSchema = z.object({
  input: z.string(),
  preconditions: z.string(),
  expectedBehavior: z.string(),
  suspiciousBehavior: z.string(),
  reproductionCode: z.string().optional(),
});

export const FindingSchema = z.object({
  id: z.string(),
  file: z.string(),
  line: z.number().optional(),
  severity: FindingSeveritySchema,
  type: FindingTypeSchema,
  title: z.string(),
  description: z.string(),
  proposedFix: z.string().optional(),
  confidence: z.enum(["high", "medium", "low"]),
  verificationHypothesis: z.string(),
  suggestedReproduction: SuggestedReproductionSchema.optional(),
});

export const ReviewReportSchema = z.object({
  summary: z.string(),
  findings: z.array(FindingSchema),
});

export type FindingSeverity = z.infer<typeof FindingSeveritySchema>;
export type FindingType = z.infer<typeof FindingTypeSchema>;
export type SuggestedReproduction = z.infer<typeof SuggestedReproductionSchema>;
export type Finding = z.infer<typeof FindingSchema>;
export type ReviewReport = z.infer<typeof ReviewReportSchema>;
