import { GitUtils } from "./git";
import { GenericJSONProvider } from "../llm/generic-json";
import { Finding, ReviewReport, ReviewReportSchema } from "../types/finding";
import { RunLogger } from "../utils/logger";
import { buildInvestigatorSystemPrompt, buildInvestigatorUserPrompt } from "../utils/agentic-prompt";
import { DockerExecutor } from "./executor";
import { Verifier } from "./verifier";

export interface AgenticPipelineConfig {
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

export class AgenticPipeline {
  private config: AgenticPipelineConfig;
  private logger: RunLogger;
  private git: GitUtils;
  private llm: GenericJSONProvider;

  constructor(config: AgenticPipelineConfig) {
    this.config = config;
    this.logger = new RunLogger(config.runDir);
    this.git = new GitUtils(config.repoPath);
    this.llm = new GenericJSONProvider();
    this.llm.init(this.config.providerConfig);
  }

  async run() {
    console.log(`Fetching Git context...`);
    this.logger.logStep("fetch_git_context");
    const context = await this.git.getContext(this.config.baseRef, this.config.headRef);
    
    if (context.files.length === 0) {
      console.log(`No changed files found between ${this.config.baseRef} and ${this.config.headRef}.`);
      return;
    }

    const systemPrompt = buildInvestigatorSystemPrompt();
    const userPrompt = buildInvestigatorUserPrompt(context);

    console.log(`Invoking Review/Investigator Agent...`);
    this.logger.logStep("invoke_investigator");
    const reviewResult = await this.llm.generateReview<ReviewReport>(
      systemPrompt,
      userPrompt,
      ReviewReportSchema,
      (attempt, error) => {
        if (error) {
          console.log(`Attempt ${attempt} failed: ${error.message}`);
          this.logger.logStep("investigator_attempt_failed", { attempt, error: error.message });
        } else {
          console.log(`Attempt ${attempt} succeeded.`);
          this.logger.logStep("investigator_attempt_succeeded", { attempt });
        }
      }
    );

    const findings = reviewResult.findings;
    console.log(`Agent returned ${findings.length} findings.`);
    
    const fs = require('fs');
    const path = require('path');
    fs.writeFileSync(path.join(this.config.runDir, "investigator-findings.json"), JSON.stringify(reviewResult, null, 2));

    // PHASE 2: Execution (Docker Sandbox) & Verification
    const executor = new DockerExecutor(this.config.repoPath);
    const verifier = new Verifier(this.llm);

    for (const finding of findings) {
      if (finding.suggestedReproduction && finding.suggestedReproduction.reproductionCode) {
        console.log(`Executing reproduction for finding ${finding.id}...`);
        this.logger.logStep("execute_reproduction", { findingId: finding.id });
        
        const execResult = await executor.runReproduction(finding.suggestedReproduction.reproductionCode);
        (finding as any).execution = execResult;

        console.log(`Verifying finding ${finding.id}...`);
        this.logger.logStep("verify_finding", { findingId: finding.id });

        const verifyResult = await verifier.verify(finding as Finding, execResult);
        (finding as any).status = verifyResult.status;
        (finding as any).verifierReasoning = verifyResult.verifierReasoning;
        
        console.log(`Verification result for ${finding.id}: ${verifyResult.status}`);
      } else {
        console.log(`No reproduction code generated for finding ${finding.id}, marking UNVERIFIED.`);
        (finding as any).status = "UNVERIFIED";
        (finding as any).verifierReasoning = "No reproduction code was provided by the investigator.";
      }
    }

    console.log(`Writing final report to ${this.config.outFile}`);
    this.logger.logReport(reviewResult);
    
    // Also save to the specified out file path
    fs.writeFileSync(this.config.outFile, JSON.stringify(reviewResult, null, 2));

    console.log("Pipeline Complete!");
  }
}
