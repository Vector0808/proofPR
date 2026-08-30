"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgenticPipeline = void 0;
const git_1 = require("./git");
const generic_json_1 = require("../llm/generic-json");
const finding_1 = require("../types/finding");
const logger_1 = require("../utils/logger");
const agentic_prompt_1 = require("../utils/agentic-prompt");
const executor_1 = require("./executor");
const verifier_1 = require("./verifier");
class AgenticPipeline {
    config;
    logger;
    git;
    llm;
    constructor(config) {
        this.config = config;
        this.logger = new logger_1.RunLogger(config.runDir);
        this.git = new git_1.GitUtils(config.repoPath);
        this.llm = new generic_json_1.GenericJSONProvider();
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
        const systemPrompt = (0, agentic_prompt_1.buildInvestigatorSystemPrompt)();
        const userPrompt = (0, agentic_prompt_1.buildInvestigatorUserPrompt)(context);
        console.log(`Invoking Review/Investigator Agent...`);
        this.logger.logStep("invoke_investigator");
        const reviewResult = await this.llm.generateReview(systemPrompt, userPrompt, finding_1.ReviewReportSchema, (attempt, error) => {
            if (error) {
                console.log(`Attempt ${attempt} failed: ${error.message}`);
                this.logger.logStep("investigator_attempt_failed", { attempt, error: error.message });
            }
            else {
                console.log(`Attempt ${attempt} succeeded.`);
                this.logger.logStep("investigator_attempt_succeeded", { attempt });
            }
        });
        const findings = reviewResult.findings;
        console.log(`Agent returned ${findings.length} findings.`);
        const fs = require('fs');
        const path = require('path');
        fs.writeFileSync(path.join(this.config.runDir, "investigator-findings.json"), JSON.stringify(reviewResult, null, 2));
        // PHASE 2: Execution (Docker Sandbox) & Verification
        const executor = new executor_1.DockerExecutor(this.config.repoPath);
        const verifier = new verifier_1.Verifier(this.llm);
        for (const finding of findings) {
            if (finding.suggestedReproduction && finding.suggestedReproduction.reproductionCode) {
                console.log(`Executing reproduction for finding ${finding.id}...`);
                this.logger.logStep("execute_reproduction", { findingId: finding.id });
                const execResult = await executor.runReproduction(finding.suggestedReproduction.reproductionCode);
                finding.execution = execResult;
                console.log(`Verifying finding ${finding.id}...`);
                this.logger.logStep("verify_finding", { findingId: finding.id });
                const verifyResult = await verifier.verify(finding, execResult);
                finding.status = verifyResult.status;
                finding.verifierReasoning = verifyResult.verifierReasoning;
                console.log(`Verification result for ${finding.id}: ${verifyResult.status}`);
            }
            else {
                console.log(`No reproduction code generated for finding ${finding.id}, marking UNVERIFIED.`);
                finding.status = "UNVERIFIED";
                finding.verifierReasoning = "No reproduction code was provided by the investigator.";
            }
        }
        console.log(`Writing final report to ${this.config.outFile}`);
        this.logger.logReport(reviewResult);
        // Also save to the specified out file path
        fs.writeFileSync(this.config.outFile, JSON.stringify(reviewResult, null, 2));
        console.log("Pipeline Complete!");
    }
}
exports.AgenticPipeline = AgenticPipeline;
