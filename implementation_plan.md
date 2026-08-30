# ProofPR Baseline V0 Implementation Plan

This document outlines the implementation plan for the Baseline V0 of ProofPR, a minimal, general-purpose LLM reviewer that outputs structured findings. As requested, this baseline explicitly avoids multi-agent orchestration, Docker execution, and GitHub integration to establish a fair starting point for the hackathon.

## User Review Required

> [!IMPORTANT]
> Please review this plan, particularly the **Structured finding schema** and the **LLM provider interface**, to ensure they meet your hackathon's baseline requirements. Once approved, I will proceed with project initialization and implementation.

## 1. Proposed Minimal Folder Structure for V0

```text
g:/ProofPR/
├── src/
│   ├── index.ts                # CLI entry point (Commander.js setup)
│   ├── commands/               # CLI commands
│   │   └── review.ts           # The main 'review' command implementation
│   ├── llm/                    # LLM Provider abstraction layer
│   │   ├── provider.ts         # Provider interface definition
│   │   └── generic-json.ts     # Generic provider implementation
│   ├── core/                   # Core business logic
│   │   ├── reviewer.ts         # Orchestrates the review process
│   │   └── git.ts              # Git CLI wrapper (fetches diffs, commit messages)
│   ├── types/                  # TypeScript types and Zod schemas
│   │   └── finding.ts          # Structured finding schema definition
│   └── utils/                  # Shared utilities
│       ├── logger.ts           # Agent-trajectory and execution logger
│       └── prompt.ts           # Prompt generation templates
├── tests/
│   ├── llm/                    # Tests for LLM interactions (mocked)
│   ├── core/                   # Tests for Git utilities and core logic
│   └── fixtures/               # Mock PRs/diffs for testing
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── .env.example
```

## 2. Required Dependencies

**Production Dependencies:**
- `commander`: For building a robust, easily extensible CLI.
- `zod`: For defining and validating the structured finding schema. Ensuring the LLM's JSON output perfectly matches our expectations is critical.
- `dotenv`: For loading API keys (e.g., `GEMINI_API_KEY`, `OPENAI_API_KEY`) from a local `.env` file.
- LLM Provider SDK (e.g., `@google/genai` or standard `fetch`): To interact with the LLM. For maximum flexibility in V0, we can use the official SDK of the chosen provider.

**Development Dependencies:**
- `typescript`, `@types/node`: For TypeScript support.
- `tsx` or `ts-node`: For directly executing the CLI during development without a separate build step.
- `vitest`: As requested, a fast and modern testing framework for unit and integration tests.

## 3. CLI Design

The primary command will be `proofpr review`. Since there is no GitHub integration yet, it will operate on the local Git repository.

**Usage:**
`proofpr review [options]`

**Options:**
- `--base <branch>`: The base branch to compare against (default: `main`).
- `--head <branch>`: The feature branch to review (default: current `HEAD`).
- `--provider <name>`: LLM provider to use (default: `gemini`).
- `--model <name>`: Specific model to use (default: `gemini-2.5-pro` or equivalent).
- `--out <file>`: Path to save the structured JSON findings (default: `proofpr-report.json`).
- `--log-dir <dir>`: Directory to save the agent trajectory and raw logs.

## 4. LLM Provider Interface

An abstraction to ensure the provider can be swapped without changing core logic.

```typescript
export interface LLMProviderConfig {
  apiKey: string;
  model: string;
}

export interface StructuredReviewResult<T> {
  findings: T[];
  rawResponse: string; // Saved for trajectory logging
  tokenUsage?: { prompt: number; completion: number };
}

export interface LLMProvider {
  init(config: LLMProviderConfig): void;
  
  /**
   * Generates a review enforcing a JSON schema output.
   */
  generateReview<T>(
    systemPrompt: string, 
    userPrompt: string,
    schema: any // Zod schema or JSON schema definition
  ): Promise<StructuredReviewResult<T>>; 
}
```

## 5. Structured Finding Schema

This is the schema the LLM will be instructed to output. It forms the basis of the "hypotheses" that future versions of ProofPR will investigate.

```typescript
// Zod equivalent will be implemented
type FindingSeverity = "critical" | "high" | "medium" | "low";
type FindingType = "bug" | "security" | "performance" | "architecture" | "style";

interface Finding {
  id: string; // Unique identifier for the finding
  file: string; // File path
  line?: number; // Specific line number, if applicable
  severity: FindingSeverity;
  type: FindingType;
  title: string; // Short summary
  description: string; // Detailed explanation of the issue
  proposedFix?: string; // Suggested code change or approach
  confidence: "high" | "medium" | "low"; // The LLM's confidence in this finding
  testability: string; // Hypothesis: How a future agent could write a test/repro for this
}

interface ReviewReport {
  summary: string; // Overall PR summary
  findings: Finding[];
}
```

## 6. Baseline Review Workflow

1. **Initialization:** CLI parses arguments and initializes the chosen LLM Provider and Logger.
2. **Context Gathering:** `git.ts` executes local git commands to extract:
   - The unified diff (`git diff base...head`).
   - The commit messages in the PR range.
   - The full file contents of modified files (to give the LLM context beyond just the changed lines).
3. **Prompt Construction:** `prompt.ts` combines the system prompt, git context, and instructions to output the requested JSON schema.
4. **LLM Execution:** The provider sends the request. The logger records the exact prompt and timestamp.
5. **Validation:** The response is parsed and validated against the Zod schema. If it fails, V0 might throw an error or attempt a single retry.
6. **Output:** The valid `ReviewReport` is saved to the `--out` file and summarized in the console.
7. **Trajectory Logging:** All raw inputs, outputs, tokens, and git commands are appended to the trajectory log.

## 7. Testing Strategy

- **Unit Tests:** 
  - Test the `git.ts` wrapper by mocking `child_process.exec`.
  - Test the Zod schema parsing with valid and invalid JSON payloads.
  - Test prompt construction logic.
- **Integration Tests:** 
  - A `fixtures` folder will contain pre-computed git diff strings and mocked LLM responses. We will run the `reviewer.ts` orchestration layer against these fixtures to ensure the pipeline connects correctly without hitting actual APIs.

## 8. Required Information from Repository/PR

To perform a capable V0 review, the LLM needs:
- **Unified Diff:** The exact additions and deletions.
- **Full Modified Files:** A 3-line context diff is rarely enough for a good AI review. We must provide the full text of any file that was changed.
- **Commit Messages:** Provides the author's intent.

*(Note: We will not attempt to resolve imports or fetch unchanged files in V0, as that adds significant complexity.)*

## 9. Agent-Trajectory Logging

For later analysis and hackathon demonstration, we will log:
- **Execution Metadata:** Timestamp, Node version, ProofPR version.
- **Action Log:** Every local command run (e.g., `git diff ...`).
- **LLM Context:** 
  - Exact System Prompt.
  - Exact User Prompt (including the injected diffs).
- **LLM Output:**
  - Raw string response from the provider.
  - Token counts and latency (ms).
- **Errors:** Any JSON parsing errors or API timeouts.

## 10. Risks & Assumptions

- **Assumption: Context Window Limits.** Providing full file contents alongside diffs could exceed context limits for very large PRs.
  - *Mitigation for V0:* We will rely on modern models (like Gemini 1.5/2.5) which have massive context windows (1M+ tokens). We will not implement aggressive chunking in V0, but will add a simple token warning if the payload is unusually large.
- **Assumption: Structured Output Reliability.** The LLM might output malformed JSON or wrap it in markdown blockticks (` ```json `).
  - *Mitigation for V0:* We will use Zod for validation and a utility function to strip markdown code blocks before parsing. If the provider supports strict JSON schema generation (like Gemini's `responseSchema` or OpenAI's Structured Outputs), we will utilize it.
- **Assumption: Local Git State.** The CLI assumes the user's local repository has the base branch fully fetched and available for `git diff`.
  - *Mitigation for V0:* Clear documentation in the CLI and helpful error messages if `git diff` fails.
