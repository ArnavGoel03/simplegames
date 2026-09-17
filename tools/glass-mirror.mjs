import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";

export const GLASS_SOURCE_LIMIT = 20000;

export function validateGlassSource(source) {
  assert(Buffer.isBuffer(source) && source.length > 0 && source.length <= GLASS_SOURCE_LIMIT, "Invalid glass source size");
  const css = new TextDecoder("utf-8", { fatal: true }).decode(source).replace(/\/\*[\s\S]*?\*\//g, "").trim();
  const root = /^:root\s*\{([^{}]+)\}$/.exec(css);
  assert(root && !/@|url\s*\(|\\/i.test(css), "Glass source must contain only local root variables");
  const declarations = root[1].split(";").map(value => value.trim()).filter(Boolean);
  const names = new Set();
  for (const declaration of declarations) {
    const match = /^(--gtg-glass-[a-z-]+)\s*:\s*(.+)$/.exec(declaration);
    assert(match && !names.has(match[1]), "Unexpected or duplicate glass variable");
    names.add(match[1]);
  }
  for (const name of ["blur", "angle", "reflection", "clear-stop", "reflection-tail", "rim", "fill", "dense-fill", "shadow"]) {
    assert(names.has(`--gtg-glass-${name}`), `Missing canonical glass variable: ${name}`);
  }
  return source;
}

export async function fetchGlassSource(source, fetcher = fetch) {
  const response = await fetcher(new URL("/glass-source.css", source), {
    signal: AbortSignal.timeout(15000),
    redirect: "manual",
  });
  assert(response.ok, `Glass source returned HTTP ${response.status}`);
  assert(/^text\/css(?:;|$)/i.test(response.headers.get("content-type") || ""), "Unexpected glass source content type");
  assert(Number(response.headers.get("content-length") || 0) <= GLASS_SOURCE_LIMIT, "Glass source exceeds limit");
  assert(response.body, "Glass source body missing");
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      assert(size <= GLASS_SOURCE_LIMIT, "Glass source exceeds limit");
      chunks.push(Buffer.from(value));
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  return validateGlassSource(Buffer.concat(chunks));
}

export function mirrorGlassSource(source, path, check = false) {
  validateGlassSource(source);
  if (check) {
    assert(readFileSync(path).equals(source), "Glass source differs from the game release");
  } else {
    writeFileSync(path, source);
  }
}
