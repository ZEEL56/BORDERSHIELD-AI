#!/usr/bin/env node
/**
 * Runs the pure-logic test suite (validation, risk engine, audit hash chain)
 * via tsx, so no compile step or database connection is required.
 * For full API/integration testing against a live database, run the app
 * with `npm run dev` and exercise the /screening/new flow, or use the
 * REST endpoints directly (see README > API Documentation).
 */
const { spawnSync } = require("child_process");
const path = require("path");

const entry = path.join(__dirname, "tests", "index.ts");
const result = spawnSync("npx", ["tsx", entry], { stdio: "inherit", shell: process.platform === "win32" });
process.exit(result.status ?? 1);
