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
exports.evaluateCommand = void 0;
const commander_1 = require("commander");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const baseline_reviewer_1 = require("../core/baseline-reviewer");
const agentic_pipeline_1 = require("../core/agentic-pipeline");
exports.evaluateCommand = new commander_1.Command("evaluate")
    .description("Run a benchmark evaluation comparing Baseline V0 to ProofPR.")
    .requiredOption("--cases <path>", "Path to the benchmark cases directory")
    .action(async (options) => {
    const provider = process.env.LLM_PROVIDER;
    const model = process.env.LLM_MODEL;
    const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || "";
    if (!provider || !model || !apiKey) {
        console.error("Error: LLM_PROVIDER, LLM_MODEL, and API key must be set.");
        process.exit(1);
    }
    const casesDir = path.resolve(process.cwd(), options.cases);
    if (!fs.existsSync(casesDir)) {
        console.error(`Error: Cases directory not found: ${casesDir}`);
        process.exit(1);
    }
    const cases = fs.readdirSync(casesDir).filter(c => fs.statSync(path.join(casesDir, c)).isDirectory());
    console.log(`Starting Evaluation on ${cases.length} cases.`);
    const results = [];
    const evalRunDir = path.resolve(process.cwd(), "runs", `eval-${new Date().toISOString().replace(/[:.]/g, "-")}`);
    fs.mkdirSync(evalRunDir, { recursive: true });
    for (const caseName of cases) {
        console.log(`\n============================`);
        console.log(`Evaluating Case: ${caseName}`);
        console.log(`============================`);
        const casePath = path.join(casesDir, caseName);
        const metaPath = path.join(casePath, "metadata.json");
        if (!fs.existsSync(metaPath)) {
            console.log(`Skipping ${caseName}: metadata.json not found.`);
            continue;
        }
        const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
        const repoPath = path.resolve(casePath, meta.repository || "repository");
        const providerConfig = { provider, model, apiKey };
        // RUN BASELINE
        console.log(`\n--- Running Baseline ---`);
        const baselineRunDir = path.join(evalRunDir, caseName, "baseline");
        const baselineReviewer = new baseline_reviewer_1.BaselineReviewer({
            repoPath,
            baseRef: meta.base,
            headRef: meta.head,
            runDir: baselineRunDir,
            outFile: path.join(baselineRunDir, "proofpr-report.json"),
            providerConfig
        });
        await baselineReviewer.run();
        // RUN AGENTIC PIPELINE
        console.log(`\n--- Running ProofPR Agentic ---`);
        const agenticRunDir = path.join(evalRunDir, caseName, "agentic");
        const pipeline = new agentic_pipeline_1.AgenticPipeline({
            repoPath,
            baseRef: meta.base,
            headRef: meta.head,
            runDir: agenticRunDir,
            outFile: path.join(agenticRunDir, "proofpr-report.json"),
            providerConfig
        });
        await pipeline.run();
        // Collect metrics
        const baselineReport = JSON.parse(fs.readFileSync(path.join(baselineRunDir, "proofpr-report.json"), "utf-8"));
        const agenticReport = JSON.parse(fs.readFileSync(path.join(agenticRunDir, "proofpr-report.json"), "utf-8"));
        const v0Findings = baselineReport.findings.length;
        const agenticFindings = agenticReport.findings.length;
        const verified = agenticReport.findings.filter((f) => f.status === "VERIFIED").length;
        const rejected = agenticReport.findings.filter((f) => f.status === "REJECTED").length;
        results.push({
            case: caseName,
            category: meta.category,
            v0Findings,
            agenticFindings,
            verified,
            rejected
        });
    }
    console.log(`\nEvaluation Complete!`);
    console.table(results);
    fs.writeFileSync(path.join(evalRunDir, "evaluation-summary.json"), JSON.stringify(results, null, 2));
});
