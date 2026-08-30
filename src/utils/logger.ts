import * as fs from "fs";
import * as path from "path";

export interface ContextStats {
  files: number;
  lines: number;
  characters: number;
  estimatedTokens: number;
}

export interface RunMetadata {
  timestamp: string;
  config: {
    provider: string;
    model: string;
    baseRef: string;
    headRef: string;
  };
  contextStats?: ContextStats;
}

export class RunLogger {
  private runDir: string;
  private trajectoryPath: string;

  constructor(runDir: string) {
    this.runDir = runDir;
    this.trajectoryPath = path.join(this.runDir, "trajectory.jsonl");

    if (!fs.existsSync(this.runDir)) {
      fs.mkdirSync(this.runDir, { recursive: true });
    }
  }

  logMetadata(metadata: RunMetadata) {
    fs.writeFileSync(
      path.join(this.runDir, "metadata.json"),
      JSON.stringify(metadata, null, 2),
      "utf-8"
    );
  }

  logStep(step: string, details?: any) {
    const entry = {
      timestamp: new Date().toISOString(),
      step,
      details,
    };
    fs.appendFileSync(this.trajectoryPath, JSON.stringify(entry) + "\n", "utf-8");
  }

  logRequest(requestPayload: any) {
    fs.writeFileSync(
      path.join(this.runDir, "request.json"),
      JSON.stringify(requestPayload, null, 2),
      "utf-8"
    );
  }

  logResponse(responsePayload: any, attempt: number = 1) {
    const fileName = attempt === 1 ? "response.json" : `response_attempt_${attempt}.json`;
    fs.writeFileSync(
      path.join(this.runDir, fileName),
      JSON.stringify(responsePayload, null, 2),
      "utf-8"
    );
  }

  logReport(report: any) {
    fs.writeFileSync(
      path.join(this.runDir, "report.json"),
      JSON.stringify(report, null, 2),
      "utf-8"
    );
  }

  estimateTokens(text: string): number {
    // A rough heuristic: 1 token ~= 4 characters for English text
    return Math.ceil(text.length / 4);
  }
}
