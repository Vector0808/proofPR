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
exports.DockerExecutor = void 0;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
class DockerExecutor {
    repoPath;
    constructor(repoPath) {
        this.repoPath = repoPath;
    }
    // Exposed for testing
    static buildDockerArgs(repoPath, tempDir) {
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
    async runReproduction(code) {
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
        let runError = undefined;
        try {
            const args = DockerExecutor.buildDockerArgs(this.repoPath, tempDir);
            await new Promise((resolve, reject) => {
                const child = (0, child_process_1.spawn)("docker", args, {
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
                    }
                    else {
                        exitCode = 1;
                    }
                    resolve();
                });
            });
        }
        catch (e) {
            if (!runError) {
                runError = e.message || "Execution failed";
            }
            exitCode = e.code ?? 1;
        }
        finally {
            // Cleanup
            try {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
            catch (err) {
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
exports.DockerExecutor = DockerExecutor;
