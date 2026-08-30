"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardCommand = void 0;
const commander_1 = require("commander");
const server_1 = require("../api/server");
exports.dashboardCommand = new commander_1.Command("dashboard")
    .description("Start the ProofPR web dashboard")
    .option("-p, --port <number>", "Port to run on", "3000")
    .action((options) => {
    console.log("Starting ProofPR Dashboard...");
    (0, server_1.startDashboardServer)(parseInt(options.port));
});
