"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewReportSchema = exports.FindingSchema = exports.SuggestedReproductionSchema = exports.FindingTypeSchema = exports.FindingSeveritySchema = void 0;
const zod_1 = require("zod");
exports.FindingSeveritySchema = zod_1.z.enum(["critical", "high", "medium", "low"]);
exports.FindingTypeSchema = zod_1.z.enum(["correctness", "regression", "validation", "error_handling", "security"]);
exports.SuggestedReproductionSchema = zod_1.z.object({
    input: zod_1.z.string(),
    preconditions: zod_1.z.string(),
    expectedBehavior: zod_1.z.string(),
    suspiciousBehavior: zod_1.z.string(),
    reproductionCode: zod_1.z.string().optional(),
});
exports.FindingSchema = zod_1.z.object({
    id: zod_1.z.string(),
    file: zod_1.z.string(),
    line: zod_1.z.number().optional(),
    severity: exports.FindingSeveritySchema,
    type: exports.FindingTypeSchema,
    title: zod_1.z.string(),
    description: zod_1.z.string(),
    proposedFix: zod_1.z.string().optional(),
    confidence: zod_1.z.enum(["high", "medium", "low"]),
    verificationHypothesis: zod_1.z.string(),
    suggestedReproduction: exports.SuggestedReproductionSchema.optional(),
});
exports.ReviewReportSchema = zod_1.z.object({
    summary: zod_1.z.string(),
    findings: zod_1.z.array(exports.FindingSchema),
});
