import { Command } from "commander";
import { config } from "dotenv";
import { reviewCommand } from "./commands/review";
import { baselineCommand } from "./commands/baseline";
import { evaluateCommand } from "./commands/evaluate";
import { dashboardCommand } from "./commands/dashboard";

// Load environment variables from .env file if present
config();

const program = new Command();

program
  .name("proofpr")
  .description("Evidence-backed AI pull-request reviewer")
  .version("1.0.0");

program.addCommand(reviewCommand);
program.addCommand(baselineCommand);
program.addCommand(evaluateCommand);
program.addCommand(dashboardCommand);

program.parse(process.argv);
