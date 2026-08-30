"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitUtils = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class GitUtils {
    repoPath;
    constructor(repoPath = process.cwd()) {
        this.repoPath = repoPath;
    }
    async run(command) {
        try {
            const { stdout } = await execAsync(`git ${command}`, { cwd: this.repoPath });
            return stdout;
        }
        catch (error) {
            throw new Error(`Git command failed: git ${command}\n${error.message}`);
        }
    }
    async getDiff(baseRef, headRef) {
        return this.run(`diff ${baseRef}...${headRef}`);
    }
    async getCommitMessages(baseRef, headRef) {
        const log = await this.run(`log ${baseRef}..${headRef} --pretty=format:"%s%n%b"`);
        return log.split("\n\n").filter(m => m.trim().length > 0);
    }
    async getChangedFiles(baseRef, headRef) {
        const output = await this.run(`diff --name-only ${baseRef}...${headRef}`);
        return output.split("\n").map(f => f.trim()).filter(f => f.length > 0);
    }
    async getFileContentAtRef(filePath, ref) {
        try {
            return await this.run(`show ${ref}:${filePath}`);
        }
        catch (e) {
            return ""; // File might be newly created or deleted
        }
    }
    async getContext(baseRef, headRef) {
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
exports.GitUtils = GitUtils;
