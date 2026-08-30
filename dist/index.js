"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const dotenv_1 = require("dotenv");
const review_1 = require("./commands/review");
const baseline_1 = require("./commands/baseline");
const evaluate_1 = require("./commands/evaluate");
const dashboard_1 = require("./commands/dashboard");
// Load environment variables from .env file if present
(0, dotenv_1.config)();
const program = new commander_1.Command();
program
    .name("proofpr")
    .description("Evidence-backed AI pull-request reviewer")
    .version("1.0.0");
program.addCommand(review_1.reviewCommand);
program.addCommand(baseline_1.baselineCommand);
program.addCommand(evaluate_1.evaluateCommand);
program.addCommand(dashboard_1.dashboardCommand);
program.parse(process.argv);
