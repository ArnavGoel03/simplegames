#!/usr/bin/env node
import { certifyGate } from "./quality/quality-runtime.mjs";
import { root, gateCommand, identity, policy } from "./release-context.mjs";
try {
  const receipt = await certifyGate({ root, command: gateCommand, identity, policy: policy() });
  console.log(`release: gate certified ${receipt.sourceHead} (${receipt.outcome.durationMs} ms)`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
