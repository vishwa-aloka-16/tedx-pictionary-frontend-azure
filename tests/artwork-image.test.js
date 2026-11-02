import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../src/lib/artworkImage.js", import.meta.url), "utf8")
  .replace("export async function", "async function");

function harness(fetch, decode = async () => {}) {
  const revoked = [];
  const context = vm.createContext({
    fetch,
    Image: class { decode() { return decode(); } },
    URL: { createObjectURL: () => "blob:artwork", revokeObjectURL: (url) => revoked.push(url) },
  });
  vm.runInContext(`${source}\nglobalThis.load = loadArtworkImage;`, context);
  return { load: context.load, revoked };
}

test("artwork stays pending through generation and browser decoding", async () => {
  let finishGeneration, finishDecode;
  let completed = false;
  const h = harness(() => new Promise((resolve) => { finishGeneration = resolve; }),
    () => new Promise((resolve) => { finishDecode = resolve; }));
  const pending = h.load("/artwork/image", new AbortController().signal).then((url) => {
    completed = true;
    return url;
  });
  assert.equal(completed, false);
  finishGeneration({ ok: true, blob: async () => ({}) });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(completed, false);
  finishDecode();
  assert.equal(await pending, "blob:artwork");
  assert.deepEqual(h.revoked, []);
});

test("failed generation rejects instead of leaving the spinner running", async () => {
  const h = harness(async () => ({ ok: false }));
  await assert.rejects(h.load("/artwork/image", new AbortController().signal), /could not be generated/);
});

test("invalid images release their blob and show an error", async () => {
  const h = harness(async () => ({ ok: true, blob: async () => ({}) }),
    async () => { throw new Error("decode failed"); });
  await assert.rejects(h.load("/artwork/image", new AbortController().signal), /decode failed/);
  assert.deepEqual(h.revoked, ["blob:artwork"]);
});

test("leaving while decoding cancels the result and releases the blob", async () => {
  let finishDecode;
  const controller = new AbortController();
  const h = harness(async () => ({ ok: true, blob: async () => ({}) }),
    () => new Promise((resolve) => { finishDecode = resolve; }));
  const pending = h.load("/artwork/image", controller.signal);
  await new Promise((resolve) => setImmediate(resolve));
  controller.abort();
  finishDecode();
  await assert.rejects(pending, { name: "AbortError" });
  assert.deepEqual(h.revoked, ["blob:artwork"]);
});
