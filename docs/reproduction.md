# ProofPR Reproduction Guide

This guide ensures anyone evaluating the hackathon project can reproduce our results from a clean slate.

## Prerequisites
- Node.js v22.x LTS
- npm v10.x
- Docker Desktop (Running and accessible)
- A Gemini API Key (`GEMINI_API_KEY`)

## 1. Clone & Setup
```bash
git clone https://github.com/proofpr/proofpr.git
cd proofpr
npm install
```

## 2. Configure Environment
Create `.env` in the root of the project:
```env
LLM_PROVIDER=gemini
LLM_MODEL=gemini-3.5-pro
GEMINI_API_KEY=your_actual_api_key_here
```

## 3. Build & Test
```bash
# Ensure strict type safety and compilation
npm run typecheck
npm run build

# Run unit tests (Mocked LLM/Git, no Docker needed)
npm test
```

## 4. Run the Full Dashboard Application
To start both the API and the React frontend simultaneously:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`.

## 5. Run the Smoke Test manually via CLI (Optional)
If you prefer the CLI, ensure you have the `proofpr-smoke` repository cloned locally:
```bash
# Assuming proofpr-smoke is at G:\proofpr-smoke
npm run dev:api -- review --repo G:\proofpr-smoke --base 0d6b62b --head 2361457
```

## 6. Run Benchmark Evaluation
To evaluate Baseline V0 vs Agentic ProofPR:
```bash
npm run dev:api -- evaluate --cases benchmark/cases
```
Results will be printed to the console and saved to `runs/eval-<timestamp>/evaluation-summary.json`. You can also view these results natively on the Dashboard's **Evaluation** page.
