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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startDashboardServer = startDashboardServer;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const agentic_pipeline_1 = require("../core/agentic-pipeline");
function startDashboardServer(port = 3000) {
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)());
    app.use(express_1.default.json());
    const runsDir = path.resolve(process.cwd(), "runs");
    if (!fs.existsSync(runsDir)) {
        fs.mkdirSync(runsDir, { recursive: true });
    }
    // In-memory job tracker for the hackathon
    const jobs = new Map();
    app.post('/api/review', async (req, res) => {
        const { repo, base, head } = req.body;
        if (!repo || !base || !head) {
            return res.status(400).json({ error: "Missing repo, base, or head" });
        }
        const provider = process.env.LLM_PROVIDER;
        const model = process.env.LLM_MODEL;
        let apiKey = "";
        if (provider === "gemini")
            apiKey = process.env.GEMINI_API_KEY || "";
        else if (provider === "openai")
            apiKey = process.env.OPENAI_API_KEY || "";
        if (!provider || !model || !apiKey) {
            return res.status(500).json({ error: "LLM Provider configuration missing in backend." });
        }
        const runId = new Date().toISOString().replace(/[:.]/g, "-");
        const runDir = path.join(runsDir, runId);
        fs.mkdirSync(runDir, { recursive: true });
        // Save metadata for the run
        fs.writeFileSync(path.join(runDir, "metadata.json"), JSON.stringify({
            repository: repo,
            base,
            head,
            timestamp: new Date().toISOString()
        }));
        jobs.set(runId, { status: 'running', runId });
        const pipeline = new agentic_pipeline_1.AgenticPipeline({
            repoPath: repo,
            baseRef: base,
            headRef: head,
            runDir,
            outFile: path.join(runDir, "proofpr-report.json"),
            providerConfig: { provider, model, apiKey }
        });
        // Run in background
        pipeline.run().then(() => {
            jobs.set(runId, { status: 'completed', runId });
        }).catch(err => {
            jobs.set(runId, { status: 'failed', runId, error: err.message });
        });
        res.json({ runId, status: 'running' });
    });
    app.get('/api/runs', (req, res) => {
        if (!fs.existsSync(runsDir))
            return res.json([]);
        const runs = fs.readdirSync(runsDir).filter(f => fs.statSync(path.join(runsDir, f)).isDirectory() && !f.startsWith("eval-"));
        const runData = runs.map(r => {
            const metaPath = path.join(runsDir, r, "metadata.json");
            let meta = {};
            if (fs.existsSync(metaPath)) {
                try {
                    meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                }
                catch (e) { }
            }
            const job = jobs.get(r);
            return { id: r, ...meta, jobStatus: job ? job.status : 'completed' };
        });
        runData.sort((a, b) => b.id.localeCompare(a.id));
        res.json(runData);
    });
    app.get('/api/runs/:id', (req, res) => {
        const runId = req.params.id;
        const runPath = path.join(runsDir, runId);
        if (!fs.existsSync(runPath)) {
            return res.status(404).json({ error: "Run not found" });
        }
        const readJson = (file) => {
            const f = path.join(runPath, file);
            if (fs.existsSync(f)) {
                try {
                    return JSON.parse(fs.readFileSync(f, 'utf8'));
                }
                catch (e) {
                    return null;
                }
            }
            return null;
        };
        const readTrajectory = () => {
            const f = path.join(runPath, "trajectory.jsonl");
            if (fs.existsSync(f)) {
                try {
                    const content = fs.readFileSync(f, 'utf8');
                    return content.split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
                }
                catch (e) {
                    return [];
                }
            }
            return [];
        };
        const job = jobs.get(runId);
        res.json({
            id: runId,
            metadata: readJson("metadata.json"),
            report: readJson("final-report.json") || readJson("proofpr-report.json") || readJson("investigator-findings.json"),
            trajectory: readTrajectory(),
            jobStatus: job ? job.status : (fs.existsSync(path.join(runPath, "proofpr-report.json")) ? 'completed' : 'failed'),
            jobError: job ? job.error : undefined
        });
    });
    app.get('/api/runs/:id/findings', (req, res) => {
        const runId = req.params.id;
        const runPath = path.join(runsDir, runId);
        if (!fs.existsSync(runPath))
            return res.status(404).json({ error: "Run not found" });
        const reportPath = path.join(runPath, "proofpr-report.json");
        if (fs.existsSync(reportPath)) {
            try {
                const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
                return res.json(report.findings || []);
            }
            catch (e) {
                return res.status(500).json({ error: "Failed to parse report" });
            }
        }
        res.json([]);
    });
    app.get('/api/evaluation', (req, res) => {
        const evals = [];
        if (fs.existsSync(runsDir)) {
            const runs = fs.readdirSync(runsDir);
            for (const r of runs) {
                if (r.startsWith("eval-")) {
                    const sumPath = path.join(runsDir, r, "evaluation-summary.json");
                    if (fs.existsSync(sumPath)) {
                        try {
                            evals.push({ id: r, results: JSON.parse(fs.readFileSync(sumPath, 'utf8')) });
                        }
                        catch (e) { }
                    }
                }
            }
        }
        evals.sort((a, b) => b.id.localeCompare(a.id));
        res.json(evals[0] || null);
    });
    app.get('/api/benchmarks', (req, res) => {
        const casesDir = path.resolve(process.cwd(), "benchmark", "cases");
        if (!fs.existsSync(casesDir))
            return res.json([]);
        const cases = fs.readdirSync(casesDir).filter(f => fs.statSync(path.join(casesDir, f)).isDirectory());
        const result = cases.map(c => {
            const metaPath = path.join(casesDir, c, "metadata.json");
            if (fs.existsSync(metaPath)) {
                try {
                    return { id: c, ...JSON.parse(fs.readFileSync(metaPath, 'utf8')) };
                }
                catch (e) { }
            }
            return { id: c };
        });
        res.json(result);
    });
    app.get('/api/settings', (req, res) => {
        res.json({
            provider: process.env.LLM_PROVIDER || 'unknown',
            model: process.env.LLM_MODEL || 'unknown',
            docker: 'Unavailable', // Docker check is complex in sync, we assume it from recent runs or report
            version: '1.0.0'
        });
    });
    app.listen(port, () => {
        console.log(`ProofPR Dashboard API running on http://localhost:${port}`);
    });
}
