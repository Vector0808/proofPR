import { Command } from "commander";
import { startDashboardServer } from "../api/server";

export const dashboardCommand = new Command("dashboard")
  .description("Start the ProofPR web dashboard")
  .option("-p, --port <number>", "Port to run on", "3000")
  .action((options) => {
    console.log("Starting ProofPR Dashboard...");
    startDashboardServer(parseInt(options.port));
  });
