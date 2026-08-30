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
exports.RunLogger = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class RunLogger {
    runDir;
    trajectoryPath;
    constructor(runDir) {
        this.runDir = runDir;
        this.trajectoryPath = path.join(this.runDir, "trajectory.jsonl");
        if (!fs.existsSync(this.runDir)) {
            fs.mkdirSync(this.runDir, { recursive: true });
        }
    }
    logMetadata(metadata) {
        fs.writeFileSync(path.join(this.runDir, "metadata.json"), JSON.stringify(metadata, null, 2), "utf-8");
    }
    logStep(step, details) {
        const entry = {
            timestamp: new Date().toISOString(),
            step,
            details,
        };
        fs.appendFileSync(this.trajectoryPath, JSON.stringify(entry) + "\n", "utf-8");
    }
    logRequest(requestPayload) {
        fs.writeFileSync(path.join(this.runDir, "request.json"), JSON.stringify(requestPayload, null, 2), "utf-8");
    }
    logResponse(responsePayload, attempt = 1) {
        const fileName = attempt === 1 ? "response.json" : `response_attempt_${attempt}.json`;
        fs.writeFileSync(path.join(this.runDir, fileName), JSON.stringify(responsePayload, null, 2), "utf-8");
    }
    logReport(report) {
        fs.writeFileSync(path.join(this.runDir, "report.json"), JSON.stringify(report, null, 2), "utf-8");
    }
    estimateTokens(text) {
        // A rough heuristic: 1 token ~= 4 characters for English text
        return Math.ceil(text.length / 4);
    }
}
exports.RunLogger = RunLogger;
