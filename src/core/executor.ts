import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  runtimeMs: number;
  error?: string;
}

export class DockerExecutor {
  private repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
  }

  // Exposed for testing
  public static buildDockerArgs(repoPath: string, tempDir: string): string[] {
    return [
      "run",
      "--rm",
      "--network", "none",
      "--memory", "512m",
      "--cpus", "1",
      "-v", `${repoPath}:/workspace:ro`,
      "-v", `${tempDir}:/runner:ro`,
      "-w", "/workspace",
      "node:22-alpine",
      "node",
      "/runner/reproduce.js"
    ];
  }

  async runReproduction(code: string): Promise<ExecutionResult> {
    const runId = `proofpr-run-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const tempDir = path.join(os.tmpdir(), runId);
    fs.mkdirSync(tempDir, { recursive: true });

    const codePath = path.join(tempDir, "reproduce.js");
    fs.writeFileSync(codePath, code, "utf-8");

    // To prevent modification of the original repo, we could copy it.
    // However, for speed and simplicity in the hackathon, we will bind mount the repo 
    // and copy package.json / node_modules if we needed to, but actually
    // the easiest sandbox is to just bind-mount the repo as read-only.
    // If the repo needs dependencies, they should already be installed on the host.
    // We will mount the repo to /workspace (read-only) and the tempDir to /runner.
    // We will run the code from /runner/reproduce.js, with CWD as /workspace.

    const startTime = Date.now();
    let stdout = "";
    let stderr = "";
    let exitCode = 0;
    let runError: string | undefined = undefined;

    try {
      const args = DockerExecutor.buildDockerArgs(this.repoPath, tempDir);

      await new Promise<void>((resolve, reject) => {
        const child = spawn("docker", args, {
          shell: false,
          windowsHide: true,
        });

        const timer = setTimeout(() => {
          runError = "Execution timed out (15s limit).";
          child.kill();
          resolve(); // Resolve rather than reject because we want to return partial stdout/stderr
        }, 15000);

        child.stdout.on("data", (data) => {
          stdout += data.toString();
        });

        child.stderr.on("data", (data) => {
          stderr += data.toString();
        });

        child.on("error", (err) => {
          clearTimeout(timer);
          reject(err);
        });

        child.on("close", (code) => {
          clearTimeout(timer);
          if (code !== null) {
            exitCode = code;
          } else {
            exitCode = 1;
          }
          resolve();
        });
      });
    } catch (e: any) {
      if (!runError) {
        runError = e.message || "Execution failed";
      }
      exitCode = e.code ?? 1;
    } finally {
      // Cleanup
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (err) {
        // Ignore cleanup errors
      }
    }

    const runtimeMs = Date.now() - startTime;

    return {
      stdout,
      stderr,
      exitCode,
      runtimeMs,
      error: runError
    };
  }
}

