import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { runCodexMaintenance } from "../src/codex-maintenance.mjs";

test("tray maintenance runs update before doctor", () => {
  const calls = [];
  const sourceRoot = path.resolve("router");
  const runner = (command, args, options) => {
    calls.push({ command, args, target: options.env.MODEL_ROUTER_TARGET });
    if (args.at(-1) === "--json") {
      return {
        status: 0,
        stdout: JSON.stringify({ ok: true, checks: [{ status: "ok", name: "Agents" }] }),
        stderr: "",
      };
    }
    return { status: 0, stdout: "{}", stderr: "" };
  };

  const result = runCodexMaintenance({
    sourceRoot,
    runner,
    executable: "/node",
    environment: {},
  });

  assert.deepEqual(calls, [
    {
      command: "/node",
      args: [path.join(sourceRoot, "src", "update.mjs"), "update"],
      target: "codex",
    },
    {
      command: "/node",
      args: [path.join(sourceRoot, "src", "doctor.mjs"), "--json"],
      target: "codex",
    },
  ]);
  assert.deepEqual(result, { updated: true, verified: true, checks: 1 });
});

test("tray maintenance summarizes failed doctor checks", () => {
  let call = 0;
  const runner = () => {
    call += 1;
    if (call === 1) return { status: 0, stdout: "{}", stderr: "" };
    return {
      status: 1,
      stdout: JSON.stringify({
        ok: false,
        checks: [
          { status: "fail", name: "Routed model agents" },
          { status: "ok", name: "Background service" },
        ],
      }),
      stderr: "",
    };
  };

  assert.throws(
    () => runCodexMaintenance({ sourceRoot: "/router", runner }),
    /Doctor found problems: Routed model agents\./,
  );
});
