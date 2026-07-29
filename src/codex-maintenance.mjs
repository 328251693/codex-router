import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function commandDetail(result, fallback) {
  if (result.error) return result.error.message;
  const detail = String(result.stderr || result.stdout || "").trim();
  return detail ? detail.slice(-2_000) : fallback;
}

function parseDoctorReport(output) {
  try {
    return JSON.parse(String(output || ""));
  } catch {
    return undefined;
  }
}

export function runCodexMaintenance({
  sourceRoot = SOURCE_ROOT,
  runner = spawnSync,
  executable = process.execPath,
  environment = process.env,
} = {}) {
  const options = {
    cwd: sourceRoot,
    env: { ...environment, MODEL_ROUTER_TARGET: "codex" },
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  };
  const update = runner(
    executable,
    [path.join(sourceRoot, "src", "update.mjs"), "update"],
    options,
  );
  if (update.error || update.status !== 0) {
    throw new Error(commandDetail(update, "Codex Router update failed."));
  }

  const doctor = runner(
    executable,
    [path.join(sourceRoot, "src", "doctor.mjs"), "--json"],
    options,
  );
  const report = parseDoctorReport(doctor.stdout);
  if (doctor.error || doctor.status !== 0) {
    const failedChecks = report?.checks
      ?.filter((check) => check.status === "fail")
      .map((check) => check.name);
    const detail = failedChecks?.length
      ? `Doctor found problems: ${failedChecks.join(", ")}.`
      : commandDetail(doctor, "Codex Router doctor failed.");
    throw new Error(detail);
  }

  return {
    updated: true,
    verified: true,
    checks: Array.isArray(report?.checks) ? report.checks.length : 0,
  };
}
