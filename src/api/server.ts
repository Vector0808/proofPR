import express from 'express';
import cors from 'cors';
import * as path from 'path';
import * as fs from 'fs';
import { AgenticPipeline } from '../core/agentic-pipeline';

export function startDashboardServer(port: number = 3000) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const runsDir = path.resolve(process.cwd(), "runs");
  if (!fs.existsSync(runsDir)) {
    fs.mkdirSync(runsDir, { recursive: true });
  }

  // In-memory job tracker for the hackathon
  const jobs = new Map<string, { status: 'running' | 'completed' | 'failed', runId: string, error?: string }>();

  app.post('/api/review', async (req, res) => {
    const { repo, base, head } = req.body;
    if (!repo || !base || !head) {
      return res.status(400).json({ error: "Missing repo, base, or head" });
    }

    const provider = process.env.LLM_PROVIDER;
    const model = process.env.LLM_MODEL;
    let apiKey = "";
    if (provider === "gemini") apiKey = process.env.GEMINI_API_KEY || "";
    else if (provider === "openai") apiKey = process.env.OPENAI_API_KEY || "";

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

    const pipeline = new AgenticPipeline({
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
    if (!fs.existsSync(runsDir)) return res.json([]);
    const runs = fs.readdirSync(runsDir).filter(f => fs.statSync(path.join(runsDir, f)).isDirectory() && !f.startsWith("eval-"));
    const runData = runs.map(r => {
      const metaPath = path.join(runsDir, r, "metadata.json");
      let meta = {};
      if (fs.existsSync(metaPath)) {
        try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch(e) {}
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
    
    const readJson = (file: string) => {
      const f = path.join(runPath, file);
      if (fs.existsSync(f)) {
        try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch(e) { return null; }
      }
      return null;
    }

    const readTrajectory = () => {
      const f = path.join(runPath, "trajectory.jsonl");
      if (fs.existsSync(f)) {
        try {
          const content = fs.readFileSync(f, 'utf8');
          return content.split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
        } catch(e) { return []; }
      }
      return [];
    }

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
    if (!fs.existsSync(runPath)) return res.status(404).json({ error: "Run not found" });
    
    const reportPath = path.join(runPath, "proofpr-report.json");
    if (fs.existsSync(reportPath)) {
      try {
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        return res.json(report.findings || []);
      } catch(e) {
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
            try { evals.push({ id: r, results: JSON.parse(fs.readFileSync(sumPath, 'utf8')) }); } catch(e) {}
          }
        }
      }
    }
    evals.sort((a, b) => b.id.localeCompare(a.id));
    res.json(evals[0] || null);
  });

  app.get('/api/benchmarks', (req, res) => {
    const casesDir = path.resolve(process.cwd(), "benchmark", "cases");
    if (!fs.existsSync(casesDir)) return res.json([]);
    const cases = fs.readdirSync(casesDir).filter(f => fs.statSync(path.join(casesDir, f)).isDirectory());
    const result = cases.map(c => {
      const metaPath = path.join(casesDir, c, "metadata.json");
      if (fs.existsSync(metaPath)) {
         try { return { id: c, ...JSON.parse(fs.readFileSync(metaPath, 'utf8')) }; } catch(e) {}
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
