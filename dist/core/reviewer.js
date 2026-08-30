"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Reviewer = void 0;
const git_1 = require("./git");
const logger_1 = require("../utils/logger");
const generic_json_1 = require("../llm/generic-json");
const finding_1 = require("../types/finding");
const prompt_1 = require("../utils/prompt");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class Reviewer {
    config;
    logger;
    git;
    llm;
    constructor(config) {
        this.config = config;
        this.logger = new logger_1.RunLogger(config.runDir);
        this.git = new git_1.GitUtils(config.repoPath);
        // For V0 we use the generic JSON provider which currently supports Gemini
        this.llm = new generic_json_1.GenericJSONProvider();
        this.llm.init(this.config.providerConfig);
    }
    async run() {
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
        const systemPrompt = (0, prompt_1.buildSystemPrompt)();
        const userPrompt = (0, prompt_1.buildUserPrompt)(gitContext);
        this.logger.logRequest({ systemPrompt, userPrompt });
        // 3. Execute LLM Review
        this.logger.logStep("Executing LLM Request");
        const result = await this.llm.generateReview(systemPrompt, userPrompt, finding_1.ReviewReportSchema, (attempt, error, rawResponse) => {
            this.logger.logStep(`LLM Response Attempt ${attempt}`, { success: !error, error: error?.message });
            if (rawResponse) {
                this.logger.logResponse({ rawResponse }, attempt);
            }
        });
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
exports.Reviewer = Reviewer;
