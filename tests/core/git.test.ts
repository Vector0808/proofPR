import { describe, it, expect, vi, beforeEach } from "vitest";
import { GitUtils } from "../../src/core/git";
import * as child_process from "child_process";

vi.mock("child_process", () => ({
  exec: vi.fn(),
}));

describe("GitUtils", () => {
  let git: GitUtils;

  beforeEach(() => {
    git = new GitUtils("/mock/repo");
    vi.resetAllMocks();
  });

  it("should get diff successfully", async () => {
    (child_process.exec as any).mockImplementation((cmd: string, opts: any, cb: any) => {
      cb(null, { stdout: "mock diff output" });
    });

    const diff = await git.getDiff("main", "feature");
    expect(diff).toBe("mock diff output");
    expect(child_process.exec).toHaveBeenCalledWith(
      "git diff main...feature",
      { cwd: "/mock/repo" },
      expect.any(Function)
    );
  });

  it("should parse commit messages", async () => {
    (child_process.exec as any).mockImplementation((cmd: string, opts: any, cb: any) => {
      cb(null, { stdout: "commit 1\n\ncommit 2\n\n" });
    });

    const commits = await git.getCommitMessages("main", "feature");
    expect(commits).toEqual(["commit 1", "commit 2"]);
    expect(child_process.exec).toHaveBeenCalledWith(
      "git log main..feature --pretty=format:\"%s%n%b\"",
      { cwd: "/mock/repo" },
      expect.any(Function)
    );
  });

  it("should parse changed files", async () => {
    (child_process.exec as any).mockImplementation((cmd: string, opts: any, cb: any) => {
      cb(null, { stdout: "src/file1.ts\nsrc/file2.ts\n" });
    });

    const files = await git.getChangedFiles("main", "feature");
    expect(files).toEqual(["src/file1.ts", "src/file2.ts"]);
    expect(child_process.exec).toHaveBeenCalledWith(
      "git diff --name-only main...feature",
      { cwd: "/mock/repo" },
      expect.any(Function)
    );
  });

  it("should handle getFileContentAtRef errors gracefully", async () => {
    (child_process.exec as any).mockImplementation((cmd: string, opts: any, cb: any) => {
      cb(new Error("fatal: path not in ref"), { stdout: "" });
    });

    const content = await git.getFileContentAtRef("newfile.ts", "feature");
    expect(content).toBe("");
    expect(child_process.exec).toHaveBeenCalledWith(
      "git show feature:newfile.ts",
      { cwd: "/mock/repo" },
      expect.any(Function)
    );
  });
});
