import { describe, it, expect } from "vitest";
import { DockerExecutor } from "../../src/core/executor";

describe("DockerExecutor", () => {
  it("builds correct docker run arguments for Windows paths", () => {
    const repoPath = "G:\\proofpr-express";
    const tempDir = "C:\\Users\\ghula\\AppData\\Local\\Temp\\proofpr-run-12345";
    
    const args = DockerExecutor.buildDockerArgs(repoPath, tempDir);
    
    expect(args).toEqual([
      "run",
      "--rm",
      "--network", "none",
      "--memory", "512m",
      "--cpus", "1",
      "-v", "G:\\proofpr-express:/workspace:ro",
      "-v", "C:\\Users\\ghula\\AppData\\Local\\Temp\\proofpr-run-12345:/runner:ro",
      "-w", "/workspace",
      "node:22-alpine",
      "node",
      "/runner/reproduce.js"
    ]);
  });
});
