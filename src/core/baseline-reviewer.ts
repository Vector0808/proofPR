import { GitUtils } from "./git";
import { RunLogger } from "../utils/logger";
import { LLMProvider, StructuredReviewResult } from "../llm/provider";
import { GenericJSONProvider } from "../llm/generic-json";
import { ReviewReport, ReviewReportSchema } from "../types/finding";
import { buildSystemPrompt, buildUserPrompt } from "../utils/prompt";
import * as path from "path";
import * as fs from "fs";

export interface BaselineReviewerConfig {
  repoPath: string;
  baseRef: string;
  headRef: string;
  runDir: string;
  outFile: string;
  providerConfig: {
    provider: string;
    model: string;
    apiKey: string;
  };
}

export class BaselineReviewer {
  private config: BaselineReviewerConfig;
  private logger: RunLogger;
  private git: GitUtils;
  private llm: LLMProvider;

  constructor(config: BaselineReviewerConfig) {
    this.config = config;
    this.logger = new RunLogger(config.runDir);
    this.git = new GitUtils(config.repoPath);
    
    // For V0 we use the generic JSON provider which currently supports Gemini
    this.llm = new GenericJSONProvider();
    this.llm.init(this.config.providerConfig);
  }

  async run(): Promise<ReviewReport> {
    this.logger.logStep("Initialization");

    // 1. Gather Context
    this.logger.logStep("Gathering Git Context");
    const gitContext = await this.git.getContext(this.config.baseRef, this.config.headRef);

    if (gitContext.diff.trim().length === 0) {
      console.warn("Warning: Diff is empty. No changes found between the specified refs.");
    }

    // Calculate context stats
    const chars = gitContext.diff.length + gitContext.files.reduce((sum, f) => sum + f.content.length, 0);
    const lines = gitContext.diff.split("\n").length + gitContext.files.reduce((sum, f) => sum + f.content.split("\n").length, 0);
    
    // Simple heuristic: 1 token ~= 4 characters
    const estimatedTokens = Math.ceil(chars / 4);

    const metadata = {
      timestamp: new Date().toISOString(),
      config: {
        provider: this.config.providerConfig.provider,
        model: this.config.providerConfig.model,
        baseRef: this.config.baseRef,
        headRef: this.config.headRef,
      },
      contextStats: {
        files: gitContext.files.length,
        lines,
        characters: chars,
        estimatedTokens
      }
    };
    
    this.logger.logMetadata(metadata);

    // 2. Build Prompts
    this.logger.logStep("Building Prompts");
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(gitContext);

    this.logger.logRequest({ systemPrompt, userPrompt });

    // 3. Execute LLM Review
    this.logger.logStep("Executing LLM Request");
    const result = await this.llm.generateReview<ReviewReport>(
      systemPrompt, 
      userPrompt, 
      ReviewReportSchema,
      (attempt, error, rawResponse) => {
        this.logger.logStep(`LLM Response Attempt ${attempt}`, { success: !error, error: error?.message });
        if (rawResponse) {
           this.logger.logResponse({ rawResponse }, attempt);
        }
      }
    );

    // 4. Output Generation
    this.logger.logStep("Finalizing Report");
    const finalReport = {
      summary: result.summary,
      findings: result.findings
    };
    
    this.logger.logReport(finalReport);

    // Save to the specified out file as well
    const finalOutPath = path.resolve(process.cwd(), this.config.outFile);
    fs.writeFileSync(finalOutPath, JSON.stringify(finalReport, null, 2), "utf-8");

    this.logger.logStep("Done");
    return finalReport;
  }
}
