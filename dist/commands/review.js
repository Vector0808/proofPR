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
exports.reviewCommand = void 0;
const commander_1 = require("commander");
const agentic_pipeline_1 = require("../core/agentic-pipeline");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
exports.reviewCommand = new commander_1.Command("review")
    .description("Perform an evidence-backed code review using LLM.")
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
    }
    else if (provider === "openai") {
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
    console.log(`Starting ProofPR Review (V1 Agentic)`);
    console.log(`Repository: ${options.repo}`);
    console.log(`Base: ${options.base} | Head: ${options.head}`);
    console.log(`Run Directory: ${runDir}`);
    const pipeline = new agentic_pipeline_1.AgenticPipeline({
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
        await pipeline.run();
    }
    catch (e) {
        console.error(`\nPipeline failed: ${e.message}`);
        process.exit(1);
    }
});
