# ProofPR Reproduction Guide

## 1. Overview

ProofPR is an agentic code review tool that moves beyond standard LLM hallucination by demanding evidence. 

The pipeline fetches a Git diff and passes it to the **Investigator Agent**, which surfaces potential bugs (hypotheses) and generates a reproduction script. This script is then passed to a sandboxed **Docker Executor** which securely mounts the repository and executes the reproduction attempt. Finally, the **Verifier Agent** analyzes the resulting `stdout`, `stderr`, and exit code from the sandbox to classify the finding, producing a final structured JSON report. 

The ultimate goal is evidence-backed AI code review where developers can immediately trust findings because they are paired with a reproducible crashing test case.

## 2. Prerequisites

To run ProofPR, you must have the following tools installed:

- Windows, Linux, or macOS
- Git
- Node.js (v22+ recommended)
- npm
- Docker Desktop (MUST be running to execute reproduction code)
- Gemini API access (API Key)

## 3. Clone Repository

Clone the repository and enter the directory:

```bash
git clone https://github.com/Vector0808/proofPR.git
cd proofPR
```

## 4. Install Dependencies

Install the backend dependencies:

```bash
npm install
```

To run the frontend dashboard, you must also install the Vite dependencies:

```bash
npm install --prefix src/frontend
```

## 5. Environment Configuration

ProofPR requires an environment file to supply API keys. Create a `.env` file in the root directory:

```env
LLM_PROVIDER=gemini
LLM_MODEL=gemini-3.6-Flash
GEMINI_API_KEY=<your_api_key>
```

> **IMPORTANT**: The `.env` file is excluded from Git via `.gitignore`. Never commit your real API key to version control.

## 6. Verify Installation

Before running a review, ensure the project builds and tests pass successfully:

```bash
npm run typecheck
npm run build
npm test
```

If successful, `typecheck` and `build` will exit silently, and `npm test` will report that all tests passed (currently 9 tests across 4 files).

## 7. Start ProofPR

To start the full-stack application (both the backend API and the Vite frontend simultaneously):

```bash
npm run dev
```

This uses `concurrently` to spawn both services. 

## 8. Frontend Dashboard

- **URL:** [http://localhost:5173](http://localhost:5173)
- **Usage:** Open the URL in a web browser. The dashboard provides fields to input the **Repository Path**, **Base Ref**, and **Head Ref**. 
- **Start Review:** Clicking the start button will send a request to the API (running on port 3000), which will spawn the pipeline. 
- **Results:** Trajectories, logs, and verified findings will be presented in the user interface once the run completes.

## 9. CLI Usage

ProofPR is powered by Commander.js and provides the following CLI commands via `src/index.ts` (which compiles to `dist/index.js` or can be run via `proofpr` if linked):

### Review
Perform an evidence-backed code review using the LLM pipeline:
```bash
proofpr review --repo <path> --base <ref> --head <ref> [--out <file>] [--run-dir <dir>]
```

### Baseline
Perform a V0 baseline (single-pass, non-executing) code review:
```bash
proofpr baseline --repo <path> --base <ref> --head <ref> [--out <file>] [--run-dir <dir>]
```

### Evaluate
Run a benchmark evaluation comparing Baseline V0 to ProofPR:
```bash
proofpr evaluate --cases <path>
```

### Dashboard
Start the API web dashboard server:
```bash
proofpr dashboard [-p, --port <number>]
```

## 10. Running a Real Repository Review

To run an end-to-end review against a real historical repository (`proofpr-express`):

1. Clone the target repository locally:
   ```bash
   git clone https://github.com/proofpr/proofpr-express.git /absolute/path/to/proofpr-express
   ```
2. Execute the CLI review command against the specific commit hashes:
   ```bash
   npx tsx src/index.ts review --repo /absolute/path/to/proofpr-express --base 59e205a57a04fced6bb7b8ec0b5dec29461a9996 --head 18e5985b8a9d5e8423db0a9121f22bdaecd5b120
   ```

## 11. Docker Sandbox

Because LLMs can generate arbitrary code, ProofPR does not intentionally execute reproductions on the host machine. Instead, it relies on a Docker sandbox:

- **Image:** Uses `node:22-alpine` for a lightweight, secure runtime.
- **Repository Mounting:** The repository being reviewed is strictly bind-mounted as Read-Only (`:ro`) to `/workspace`. 
- **Runner Mounting:** The generated reproduction script (`reproduce.js`) is written to a temporary host directory and mounted to `/runner:ro`.
- **Resource Limits:** Docker is constrained to 512MB memory (`--memory 512m`) and 1 CPU core (`--cpus 1`), with network access disabled (`--network none`).
- **Timeouts:** A strict 15-second timeout is enforced by `child_process.spawn`.

## 12. Evidence and Verification

Once the Investigator generates a reproduction script, Docker executes it. The captured `stdout`, `stderr`, and exit code form the **evidence**. The Verifier Agent receives this evidence and the original hypothesis to determine the final status:

- **VERIFIED:** The execution strictly proves the finding (e.g., exact crash thrown).
- **LIKELY:** Execution partially supports the finding.
- **REJECTED:** Execution contradicts the finding (e.g., it runs without error).
- **UNVERIFIED:** The reproduction script failed to compile, timed out, or Docker failed.

## 13. Run Artifacts

ProofPR generates persistent run directories located at `runs/<timestamp>/`. The structure includes:

- `metadata.json`: Details on the provider, model, and git refs.
- `trajectory.jsonl`: Step-by-step logs of the agent's progress.
- `request.json` / `response.json`: Raw LLM prompts and completions.
- `investigator-findings.json`: The intermediate structured findings from the Investigator.
- `report.json` & `proofpr-report.json`: The final output combining findings with Verifier reasoning and execution statuses.

> *Note: Temporary execution directories (containing `reproduce.js`) are cleaned up automatically after sandbox execution.*

## 14. Benchmark Evaluation

ProofPR includes an `evaluate` command designed to quantify the precision and recall improvements over a non-agentic baseline. The benchmark currently tests cases like `proofpr-smoke`.

**IMPORTANT LIMITATION:**
The final quantitative benchmark evaluation could not be completed during the hackathon due to Gemini Free Tier API quota limits (HTTP 429 `RESOURCE_EXHAUSTED`). Multi-agent loops require significant request volume (Baseline + Investigator + Verifier per case), which rapidly exhausts the free tier (20 RPM/RPD). As a result, no fabricated quantitative improvement claims (precision, recall, etc.) are asserted here, but the architectural improvement is documented.

## 15. Successful Demonstration

The ProofPR pipeline successfully executes against simple, reproducible issues like the `proofpr-smoke` demonstration:

1. **Bug Introduced:** A null-reference check on `user.address` is removed.
2. **Identification:** The AI correctly hypothesizes a `TypeError` when `address` is missing.
3. **Reproduction:** The AI generates a script calling the function with `{}` (omitting address).
4. **Execution:** The Docker sandbox runs the code, capturing the resulting `TypeError: Cannot read properties of undefined (reading 'city')`.
5. **Verification:** The Verifier reads the `stderr` stack trace, matches it to the hypothesis, and upgrades the finding to **VERIFIED**.

## 16. Troubleshooting

- **Gemini API Quota (HTTP 429):** If you see `Structured output parsing failed` or `RESOURCE_EXHAUSTED`, you have hit your LLM provider's rate limit. Wait for the quota to reset before running another review.
- **Docker Errors (`Exit Code: 125` or `connect ENOENT`):** Docker Desktop must be running. If it is running and you still get errors on Windows, ensure your repository paths are absolute and mapped correctly. 
- **Windows Docker Execution:** Previously, string-interpolated `child_process.exec` commands failed on Windows due to escape characters (`\`) in paths. This was resolved by using `child_process.spawn` with an exact argument array.
- **Git Reference Errors:** The repository must be a valid Git project, and the provided `--base` and `--head` references must exist locally. 

## 17. Security

- API Keys are only read from `process.env` and `.env` files, which are git-ignored.
- Generated code is executed in an isolated Docker sandbox with no network access (`--network none`).
- The codebase being reviewed is shielded from malicious reproduction scripts by read-only (`ro`) volume mounts.

## 18. Reproducibility Checklist

- [ ] Node/npm installed
- [ ] Docker Desktop running
- [ ] Repository cloned
- [ ] npm install completed
- [ ] .env configured
- [ ] typecheck passes
- [ ] build passes
- [ ] tests pass
- [ ] frontend starts
- [ ] review executes
- [ ] Docker reproduction executes
- [ ] evidence appears
- [ ] verifier produces final classification
