# ProofPR Experiments Changelog

## V0: Baseline LLM Reviewer
- **What was tried?** A standard prompt passing the Git diff to Gemini to extract structured findings.
- **Why?** To establish a control group.
- **Result?** It successfully found bugs but also occasionally hallucinated issues.
- **Decision?** Keep as the baseline for `proofpr evaluate`.

## V1: Agentic Reviewer & Hypothesis Generation
- **What was tried?** Splitting the reviewer into an Investigator that must form a specific "verification hypothesis" for each finding.
- **Why?** To give the system a testable claim to prove.
- **Result?** Findings became much more concrete and actionable.
- **Decision?** Retained in final pipeline.

## V2: Reproduction Generation
- **What was tried?** Prompting the LLM to output a standalone Node.js script to trigger the bug.
- **Why?** We need executable evidence.
- **Result?** The LLM could generate scripts, but they often failed on missing dependencies or incorrect paths.
- **Decision?** Refined the prompt to heavily constrain module imports and encourage using the local project context.

## V3: Docker Sandboxing
- **What was tried?** Executing the reproduction script locally via `child_process`.
- **Why?** Fastest way to run tests.
- **Result?** Security nightmare; the LLM could execute arbitrary code on the host.
- **Decision?** Moved execution exclusively to a `node:22-alpine` Docker container with a read-only bind mount to the target repo.

## V4: The Verifier Agent
- **What was tried?** Hardcoding regex to check if `exitCode !== 0` means verified.
- **Why?** Simple verification.
- **Result?** Brittle. Tests can fail for infrastructure reasons, or because the test framework wasn't installed.
- **Decision?** Introduced a secondary LLM "Verifier" Agent that inspects the raw `stdout`/`stderr` against the Hypothesis to logically determine `VERIFIED`, `REJECTED`, or `UNVERIFIED`.

## Final Architecture
The final system retains all evidence-supported approaches from V4. Failed Docker connections are handled gracefully by yielding an `UNVERIFIED` state instead of crashing.
