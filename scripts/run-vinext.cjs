#!/usr/bin/env node
/** Wraps vinext commands with WRANGLER_LOG_PATH set for cross-platform compatibility.
 * Works in git-bash on Windows where `VAR=value command` syntax fails.
 */
process.env.WRANGLER_LOG_PATH =
  process.env.WRANGLER_LOG_PATH || ".wrangler/wrangler.log";
const { execSync } = require("child_process");
const cmd = "npx vinext " + process.argv.slice(2).join(" ");
console.log("[wrangler-wrapper] " + cmd);
execSync(cmd, { stdio: "inherit" });
