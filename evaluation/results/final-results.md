# ProofPR Final Evaluation Results

This document presents the final evaluation benchmark results comparing Baseline V0 against the Final Agentic ProofPR.

## Primary Metric

| Metric | Baseline V0 | Final ProofPR | Change |
|--------|-------------|---------------|--------|
| **Evidence-backed finding accuracy** | Unavailable* | Unavailable* | N/A |
| Precision | Unavailable | Unavailable | N/A |
| Recall | Unavailable | Unavailable | N/A |
| False positive rate | Unavailable | Unavailable | N/A |
| False negative rate | Unavailable | Unavailable | N/A |
| Reproduction success rate | N/A (Baseline does not reproduce) | Unavailable* | N/A |
| Verification rate | N/A | Unavailable* | N/A |
| Average runtime | Unavailable | Unavailable | N/A |
| LLM request count | Unavailable | Unavailable | N/A |
| Approximate cost | Unavailable | Unavailable | N/A |

*\*Metrics marked as **Unavailable** were unable to be measured because the evaluation pipeline failed due to external rate limit quotas (`RESOURCE_EXHAUSTED` / `429 Too Many Requests`) from the Gemini API Free Tier.*

## Per-Case Results

| Case | Ground Truth | Baseline | Final | Verified | Correct |
|------|--------------|----------|-------|----------|---------|
| `case-001` | TypeError on undefined address | Failed (Quota) | Failed (Quota) | N/A | N/A |
| `case-002` | Out of bounds loop (TypeError) | Failed (Quota) | Failed (Quota) | N/A | N/A |
| `case-003` | Missing return value | Failed (Quota) | Failed (Quota) | N/A | N/A |

## Challenging Case Analysis

**Case:** `case-001` (`proofpr-smoke`)
**Why it was difficult:** The bug (a removed `null` check) only throws a `TypeError` at runtime if the `user` object passed to the function happens to omit the `address` property. It requires the agent to infer how the function is typically called and to synthesize a mock `user` object in the reproduction script that correctly triggers the boundary condition.
**What the baseline did:** The baseline was unable to run due to LLM quota limits, but theoretically, it would flag this as a potential null reference without proof.
**What ProofPR did:** The pipeline execution failed during the Investigator Agent phase because of API rate limits. 
**Verification impact:** Had it completed, verification would have caught if the reproduction script failed to trigger the error, ensuring that we only report it if we can prove `user.address.city` crashes when `user.address` is missing.
**What this revealed:** Agentic code review requires robust, high-limit LLM access, as multi-step loops quickly consume free-tier quotas.

## Raw Evidence

The `proofpr-report.json` files and Docker execution logs could not be fully generated for these cases due to the API limits. The primary error captured across all executions was:

```json
{
  "error": {
    "code": 429,
    "message": "You exceeded your current quota, please check your plan and billing details.",
    "status": "RESOURCE_EXHAUSTED"
  }
}
```
