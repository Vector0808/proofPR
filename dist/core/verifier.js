"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Verifier = exports.VerificationResultSchema = void 0;
const zod_1 = require("zod");
exports.VerificationResultSchema = zod_1.z.object({
    status: zod_1.z.enum(["VERIFIED", "LIKELY", "REJECTED", "UNVERIFIED"]),
    verifierReasoning: zod_1.z.string()
});
class Verifier {
    llm;
    constructor(llm) {
        this.llm = llm;
    }
    async verify(finding, executionResult) {
        const systemPrompt = `You are ProofPR Verifier. Your job is to analyze the result of a generated reproduction test and determine if the original finding is proven.
    
Statuses:
- VERIFIED: The execution strictly proves the finding (e.g., the exact expected error/crash was thrown, or the assertion failed).
- REJECTED: The execution contradicts the finding (e.g., it ran perfectly fine without error when an error was claimed, or the output was correct).
- LIKELY: The execution partially supports the finding but isn't a strict proof.
- UNVERIFIED: The reproduction script failed to compile, couldn't find dependencies, or timed out.

OUTPUT FORMAT:
Return ONLY a valid JSON object matching:
{
  "status": "VERIFIED" | "LIKELY" | "REJECTED" | "UNVERIFIED",
  "verifierReasoning": "Explanation of why the execution result proves/disproves the finding."
}`;
        let userPrompt = `=== FINDING ===\n`;
        userPrompt += `Title: ${finding.title}\n`;
        userPrompt += `Description: ${finding.description}\n`;
        userPrompt += `Hypothesis: ${finding.verificationHypothesis}\n\n`;
        userPrompt += `=== REPRODUCTION CODE ===\n`;
        userPrompt += `${finding.suggestedReproduction?.reproductionCode || "None provided"}\n\n`;
        userPrompt += `=== EXECUTION RESULT ===\n`;
        userPrompt += `Exit Code: ${executionResult.exitCode}\n`;
        userPrompt += `Error: ${executionResult.error || "None"}\n`;
        userPrompt += `--- STDOUT ---\n${executionResult.stdout}\n`;
        userPrompt += `--- STDERR ---\n${executionResult.stderr}\n`;
        const result = await this.llm.generateReview(systemPrompt, userPrompt, exports.VerificationResultSchema);
        return {
            status: result.status,
            verifierReasoning: result.verifierReasoning
        };
    }
}
exports.Verifier = Verifier;
