import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const runtimeRoot = process.env.SITES_RUNTIME_ROOT || path.join(projectRoot, ".sites-runtime");
const envFile = path.join(projectRoot, ".env");
const localEnvFile = path.join(projectRoot, ".env.local");

// Production-style local runs should exercise the same values supplied in
// `.env`. Keep `.env.local` as a backwards-compatible fallback.
if (existsSync(envFile)) process.argv.push("--env-file", envFile);
else if (existsSync(localEnvFile)) process.argv.push("--env-file", localEnvFile);

process.env.CLOUDFLARE_CF_FETCH_ENABLED ||= "false";
process.env.WRANGLER_SEND_METRICS ||= "false";
process.env.WRANGLER_WRITE_LOGS ||= "false";
process.env.WRANGLER_LOG_PATH ||= path.join(runtimeRoot, "wrangler/logs");
process.env.WRANGLER_REGISTRY_PATH ||= path.join(runtimeRoot, "wrangler/dev-registry");
process.env.MINIFLARE_REGISTRY_PATH ||= path.join(runtimeRoot, "wrangler/registry");

process.chdir(projectRoot);
for (const directory of [
  path.dirname(process.env.WRANGLER_LOG_PATH),
  process.env.WRANGLER_REGISTRY_PATH,
  process.env.MINIFLARE_REGISTRY_PATH,
]) {
  mkdirSync(directory, { recursive: true });
}
