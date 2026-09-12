import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transformSync } from "esbuild";
import { afterEach, expect, it, vi } from "vitest";

const code = transformSync(readFileSync(new URL("./Commitment.tsx", import.meta.url), "utf8"), {
  loader: "tsx",
  format: "cjs",
  jsx: "automatic",
}).code;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

// Supply a committed ceremony and control crypto completion independently of
// the autoplay clock. This exercises the actual component's callbacks without
// introducing a DOM dependency just to test an async race.
function harness(initial: "pending" | "committed" | "rolled" = "committed") {
  const ceremony = {
    seed: new Uint8Array(32), commitment: "committed", rolls: null, hand: null,
    stage: initial === "rolled" ? "rolled" : "committed", verified: null,
  };
  const slots: unknown[] = [initial === "pending" ? null : ceremony, false, false];
  let stateIndex = 0;
  let refIndex = 0;
  const effects: Array<() => void> = [];
  const actions: Array<(...args: unknown[]) => Promise<void>> = [];
  const refs: Array<{ current: unknown }> = [];
  const pending: ReturnType<typeof deferred<number[]>>[] = [];
  const rollSeries = vi.fn(() => {
    const task = deferred<number[]>();
    pending.push(task);
    return task.promise;
  });
  const commitSeed = vi.fn(async () => "new commitment");
  const verifyCommitment = vi.fn(async () => true);
  const modules: Record<string, unknown> = {
    react: {
      useState: () => {
        const index = stateIndex++;
        return [slots[index], (value: unknown) => {
          slots[index] = typeof value === "function" ? value(slots[index]) : value;
        }];
      },
      useRef: (value: unknown) => {
        const index = refIndex++;
        refs[index] ??= { current: value };
        return refs[index];
      },
      useCallback: (callback: (...args: unknown[]) => Promise<void>) => {
        actions.push(callback);
        return callback;
      },
      useEffect: (effect: () => void) => effects.push(effect),
    },
    "react/jsx-runtime": {
      jsx: (type: unknown, props: unknown) => ({ type, props }),
      jsxs: (type: unknown, props: unknown) => ({ type, props }),
    },
    "@/lib/fairness": {
      rollSeries, commitSeed, verifyCommitment,
      generateSeed: () => new Uint8Array(32),
      bytesToHex: () => "revealed seed",
    },
    "@/lib/cards": {
      cardsInRound: () => 9,
      dealRound: async () => [[{ rank: 2, suit: "spades" }]],
      trumpForRound: () => "spades",
      SUIT_LABEL: { spades: "spades" },
    },
  };
  const componentModule = { exports: {} as { Commitment: () => unknown } };
  runInNewContext(code, {
    require: (name: string) => modules[name],
    module: componentModule, exports: componentModule.exports,
    setTimeout, clearTimeout,
  });
  function render() {
    stateIndex = 0;
    refIndex = 0;
    actions.length = 0;
    effects.length = 0;
    return componentModule.exports.Commitment();
  }
  render();
  return { ceremony, slots, refs, effects, actions, pending, rollSeries, commitSeed, verifyCommitment, render };
}

function buttons(tree: unknown): Array<{ children: string; disabled: boolean; onClick: () => void }> {
  if (Array.isArray(tree)) return tree.flatMap(buttons);
  if (!tree || typeof tree !== "object") return [];
  const node = tree as { type: unknown; props: { children: unknown } };
  if (node.type === "button") return [node.props as ReturnType<typeof buttons>[number]];
  return buttons(node.props?.children);
}

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

afterEach(() => vi.useRealTimers());

it("does not let the autoplay timer start a second manual roll", async () => {
  vi.useFakeTimers();
  const h = harness();
  h.effects[1]();
  h.refs[0].current = false;
  const first = h.actions[0](h.ceremony);
  await vi.advanceTimersByTimeAsync(1100);
  expect(h.rollSeries).toHaveBeenCalledTimes(1);
  h.pending[0].resolve([1, 2, 3, 4, 5]);
  await first;
  expect(h.slots[0]).toMatchObject({ stage: "rolled" });
  expect(h.slots[1]).toBe(false);
});

it("refuses a second action before React has rendered the disabled button", async () => {
  const h = harness();
  const first = h.actions[0](h.ceremony);
  const second = h.actions[0](h.ceremony);
  expect(h.rollSeries).toHaveBeenCalledTimes(1);
  h.pending[0].resolve([1, 2, 3, 4, 5]);
  await Promise.all([first, second]);
});

it("releases the action after failed crypto so the user can retry", async () => {
  const h = harness();
  const first = h.actions[0](h.ceremony);
  h.pending[0].reject(new Error("crypto unavailable"));
  await expect(first).resolves.toBeUndefined();
  expect(h.slots[1]).toBe(false);
  expect(h.refs[0].current).toBe(false);
  expect(h.slots[0]).toBe(h.ceremony);
  const retry = h.actions[0](h.ceremony);
  h.pending[1].resolve([1, 2, 3, 4, 5]);
  await retry;
  expect(h.slots[0]).toMatchObject({ stage: "rolled" });
});

it("offers a retry after initialization fails without silently retrying itself", async () => {
  const h = harness("pending");
  h.commitSeed
    .mockRejectedValueOnce(new Error("crypto unavailable"))
    .mockRejectedValueOnce(new Error("crypto still unavailable"));
  h.effects[0]();
  await flush();
  expect(h.slots[0]).toBeNull();
  expect(h.refs[0].current).toBe(false);
  const retry = buttons(h.render()).find((button) => button.children === "Run it again");
  expect(retry).toBeDefined();
  expect(retry?.disabled).toBe(false);
  expect(h.commitSeed).toHaveBeenCalledTimes(1);
  retry?.onClick();
  await flush();
  expect(h.slots[0]).toBeNull();
  expect(h.slots[1]).toBe(false);
  expect(h.refs[0].current).toBe(false);
  const secondRetry = buttons(h.render()).find((button) => button.children === "Run it again");
  expect(secondRetry).toBeDefined();
  secondRetry?.onClick();
  await flush();
  expect(h.slots[0]).toMatchObject({ stage: "committed", commitment: "new commitment" });
  expect(h.refs[0].current).toBe(true);
  expect(buttons(h.render()).map((button) => button.children)).toEqual(["Roll and deal"]);
});

it("keeps the rolled ceremony and reveal button when verification fails", async () => {
  const h = harness("rolled");
  h.verifyCommitment.mockRejectedValueOnce(new Error("crypto unavailable"));
  await expect(h.actions[1](h.ceremony)).resolves.toBeUndefined();
  expect(h.slots[0]).toBe(h.ceremony);
  expect(h.slots[1]).toBe(false);
  expect(h.refs[0].current).toBe(false);
  const retry = buttons(h.render()).find((button) => button.children === "Reveal the number");
  expect(retry).toBeDefined();
  retry?.onClick();
  await flush();
  expect(h.slots[0]).toMatchObject({ stage: "revealed", verified: true });
});
