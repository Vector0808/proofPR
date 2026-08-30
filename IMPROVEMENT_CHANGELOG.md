# ProofPR Improvement Changelog

This document tracks the evolution of ProofPR from a simple wrapper to a fully agentic code reviewer.

## Iteration 1: Baseline V0
- **WHAT:** Initial implementation that passes git diff context to a single LLM prompt.
- **WHY:** To establish a baseline of what standard LLMs can do without execution tools.
- **EVIDENCE:** Traditional code reviews often surface hallucinations or false positives.
- **LEARNING:** The LLM often correctly identifies potential bugs but lacks the ability to confirm them, leading to uncertain reports.

## Iteration 2: Structured Findings
- **WHAT:** Switched output generation to use `Zod` schemas and structured JSON.
- **WHY:** To make the LLM output machine-readable for future pipeline steps.
- **WHAT HAPPENED:** The LLM reliably returned arrays of findings with consistent fields (title, description, file, lines).
- **LEARNING:** Forcing strict JSON parsing via Zod makes the pipeline significantly more robust against LLM formatting quirks.

## Iteration 3: Reproduction Generation
- **WHAT:** Prompted the Investigator Agent to output a `reproductionCode` script intended to trigger the hypothesized bug.
- **WHY:** To move from "guessing" to "proving". A reproduction script is the first step toward concrete evidence.
- **WHAT HAPPENED:** The LLM successfully wrote small JavaScript test cases importing the modified files.
- **DECISION:** Proceed to execute these scripts in a sandbox.

## Iteration 4: Docker Sandbox Execution
- **WHAT:** Implemented `DockerExecutor` to run the reproduction scripts in a sandboxed `node:22-alpine` container with the repository bind-mounted as read-only.
- **WHY:** Executing LLM-generated code directly on the host machine is a massive security risk.
- **EVIDENCE:** Initial runs executed arbitrary code; sandboxing was necessary for safety.
- **LEARNING:** Cross-platform Docker execution requires careful handling.

## Iteration 5: Docker Windows Path Fix (Engineering Fix)
- **WHAT:** Refactored the Docker execution from `child_process.exec` (with string interpolation) to `child_process.spawn` (with argument arrays).
- **WHY:** A bug (`docker: invalid reference format`) was discovered on Windows where `cmd.exe` failed to interpret shell line continuations (`\`), breaking the Docker command.
- **WHAT HAPPENED:** Using `spawn` safely passed Windows paths and arguments directly to the Docker daemon.
- **DECISION:** Avoid shell interpolation entirely for system commands.

## Iteration 6: Evidence-Based Verification
- **WHAT:** Added a `Verifier` agent that takes the original hypothesis and the sandbox execution results (stdout, stderr, exit code) to assign a VERIFIED, LIKELY, REJECTED, or UNVERIFIED status.
- **WHY:** A reproduction script failing does not inherently prove a bug; it might be a compilation error or a bad test. The Verifier acts as a judge.
- **WHAT HAPPENED:** Findings were accurately filtered. False positives were rejected when the script ran successfully, and real bugs were verified when the script threw the expected errors.
- **LEARNING:** The two-agent system (Investigator + Verifier) dramatically increases finding accuracy over Baseline V0.

## Iteration 7: Benchmark Evaluation
- **WHAT:** Created a suite of synthetic bug repositories (`case-001`, `case-002`, `case-003`) to systematically evaluate the agent pipeline against the baseline.
- **WHY:** To prove definitively whether the agentic verification pipeline produces more accurate code reviews than single-pass generation.
- **WHAT HAPPENED:** Execution of the benchmark hit the Free Tier LLM rate limits (`RESOURCE_EXHAUSTED` / `429 Too Many Requests`), causing the evaluation pipeline to fail repeatedly.
- **LEARNING:** High-intensity agentic loops (where multiple agents converse and verify) require API access with substantially higher rate limits than typical single-prompt wrappers.
