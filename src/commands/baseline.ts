import { Command } from "commander";
import { BaselineReviewer } from "../core/baseline-reviewer";
import * as path from "path";
import * as fs from "fs";

export const baselineCommand = new Command("baseline")
  .description("Perform a V0 baseline evidence-backed code review using LLM.")
  .requiredOption("--repo <path>", "Path to the Git repository being reviewed")
  .requiredOption("--base <ref>", "The base branch name or commit SHA to compare against")
  .requiredOption("--head <ref>", "The feature branch name or commit SHA to review")
  .option("--out <file>", "Path to save the structured JSON findings", "proofpr-report.json")
  .option("--run-dir <dir>", "Directory to save the run outputs")
  .action(async (options) => {
    // 1. Load config from environment
    const provider = process.env.LLM_PROVIDER;
    const model = process.env.LLM_MODEL;
    let apiKey = "";

    if (!provider || !model) {
      console.error("Error: LLM_PROVIDER and LLM_MODEL must be set in the environment.");
      process.exit(1);
    }

    if (provider === "gemini") {
      apiKey = process.env.GEMINI_API_KEY || "";
    } else if (provider === "openai") {
      apiKey = process.env.OPENAI_API_KEY || "";
    }

    if (!apiKey) {
      console.error(`Error: API key for provider '${provider}' is not set.`);
      process.exit(1);
    }

    // 2. Determine run directory
    const runDir = options.runDir 
      ? path.resolve(process.cwd(), options.runDir)
      : path.resolve(process.cwd(), "runs", new Date().toISOString().replace(/[:.]/g, "-"));

    if (!fs.existsSync(runDir)) {
      fs.mkdirSync(runDir, { recursive: true });
    }

    console.log(`Starting ProofPR Baseline Review (V0)`);
    console.log(`Repository: ${options.repo}`);
    console.log(`Base: ${options.base} | Head: ${options.head}`);
    console.log(`Run Directory: ${runDir}`);

    const reviewer = new BaselineReviewer({
      repoPath: options.repo,
      baseRef: options.base,
      headRef: options.head,
      runDir,
      outFile: options.out,
      providerConfig: {
        provider,
        model,
        apiKey
      }
    });

    try {
      const report = await reviewer.run();
      console.log(`\nReview Complete!`);
      console.log(`Summary: ${report.summary}`);
      console.log(`Found ${report.findings.length} findings.`);
      console.log(`Detailed report saved to: ${options.out}`);
    } catch (error: any) {
      console.error(`\nReview failed: ${error.message}`);
      process.exit(1);
    }
  });
