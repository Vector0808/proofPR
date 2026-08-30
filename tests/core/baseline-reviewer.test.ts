import { describe, it, expect, vi } from "vitest";
import { BaselineReviewer } from "../../src/core/baseline-reviewer";
import * as path from "path";
import * as fs from "fs";

vi.mock("../../src/core/git", () => ({
  GitUtils: class {
    getContext = vi.fn().mockResolvedValue({
      diff: "mock diff",
      files: [{ path: "mock.ts", content: "mock content" }],
      commits: ["mock commit"]
    });
  }
}));

vi.mock("../../src/llm/generic-json", () => ({
  GenericJSONProvider: class {
    init = vi.fn();
    generateReview = vi.fn().mockResolvedValue({
      summary: "Integration Mock Summary",
      findings: [],
      rawResponse: "mock response"
    });
  }
}));

describe("BaselineReviewer Integration", () => {
  it("should run review end-to-end and generate run directory", async () => {
    const runDir = path.resolve(process.cwd(), "tests/fixtures/run-test");
    if (fs.existsSync(runDir)) fs.rmSync(runDir, { recursive: true });

    const reviewer = new BaselineReviewer({
      repoPath: "/mock/repo",
      baseRef: "main",
      headRef: "feature",
      runDir,
      outFile: path.join(runDir, "proofpr-report.json"),
      providerConfig: {
        provider: "gemini",
        model: "gemini-2.5-pro",
        apiKey: "test"
      }
    });

    const report = await reviewer.run();
    expect(report.summary).toBe("Integration Mock Summary");

    // Verify files were created
    expect(fs.existsSync(path.join(runDir, "metadata.json"))).toBe(true);
    expect(fs.existsSync(path.join(runDir, "trajectory.jsonl"))).toBe(true);
    expect(fs.existsSync(path.join(runDir, "request.json"))).toBe(true);
    expect(fs.existsSync(path.join(runDir, "report.json"))).toBe(true);
    
    // Cleanup
    fs.rmSync(runDir, { recursive: true });
  });
});
