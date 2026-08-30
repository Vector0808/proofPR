import { exec } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as fs from "fs";

const execAsync = promisify(exec);

export interface GitContext {
  diff: string;
  files: Array<{
    path: string;
    content: string;
  }>;
  commits: string[];
}

export class GitUtils {
  private repoPath: string;

  constructor(repoPath: string = process.cwd()) {
    this.repoPath = repoPath;
  }

  private async run(command: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`git ${command}`, { cwd: this.repoPath });
      return stdout;
    } catch (error: any) {
      throw new Error(`Git command failed: git ${command}\n${error.message}`);
    }
  }

  async getDiff(baseRef: string, headRef: string): Promise<string> {
    return this.run(`diff ${baseRef}...${headRef}`);
  }

  async getCommitMessages(baseRef: string, headRef: string): Promise<string[]> {
    const log = await this.run(`log ${baseRef}..${headRef} --pretty=format:"%s%n%b"`);
    return log.split("\n\n").filter(m => m.trim().length > 0);
  }

  async getChangedFiles(baseRef: string, headRef: string): Promise<string[]> {
    const output = await this.run(`diff --name-only ${baseRef}...${headRef}`);
    return output.split("\n").map(f => f.trim()).filter(f => f.length > 0);
  }

  async getFileContentAtRef(filePath: string, ref: string): Promise<string> {
    try {
      return await this.run(`show ${ref}:${filePath}`);
    } catch (e) {
      return ""; // File might be newly created or deleted
    }
  }

  async getContext(baseRef: string, headRef: string): Promise<GitContext> {
    const diff = await this.getDiff(baseRef, headRef);
    const commits = await this.getCommitMessages(baseRef, headRef);
    const changedFilePaths = await this.getChangedFiles(baseRef, headRef);
    
    const files = [];
    for (const filePath of changedFilePaths) {
      // For V0, we retrieve the content of the file at the headRef 
      // to give the LLM context of what the file currently looks like.
      const content = await this.getFileContentAtRef(filePath, headRef);
      if (content) {
        files.push({ path: filePath, content });
      }
    }

    return { diff, files, commits };
  }
}
