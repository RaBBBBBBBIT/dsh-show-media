import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import {
  bytesToBase64,
  envelope,
  extractImage,
  kindFor,
  parseCallPath,
  parseDims,
  parseOriginalMeta,
} from "../lib/media.js";

describe("kindFor", () => {
  it("classifies image and video extensions", () => {
    assert.deepEqual(kindFor("C:\\\\a\\\\b.webp"), { kind: "image", mediaType: "image/webp" });
    assert.deepEqual(kindFor("clip.MP4"), { kind: "video", mediaType: "video/mp4" });
    assert.equal(kindFor("notes.txt"), undefined);
  });
});

describe("parseDims", () => {
  it("reads a VP8X webp canvas size", () => {
    const bytes = new Uint8Array(30);
    bytes.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58], 0);
    bytes[24] = 163; // 164 - 1
    bytes[27] = 161; // 162 - 1
    assert.deepEqual(parseDims(bytes, "image/webp"), { width: 164, height: 162 });
  });

  it("reads a PNG IHDR size", () => {
    const bytes = new Uint8Array(24);
    bytes[0] = 137;
    bytes[1] = 80;
    bytes[16] = 0;
    bytes[17] = 0;
    bytes[18] = 1;
    bytes[19] = 164; // 420
    bytes[20] = 0;
    bytes[21] = 0;
    bytes[22] = 1;
    bytes[23] = 162; // 418
    assert.deepEqual(parseDims(bytes, "image/png"), { width: 420, height: 418 });
  });
});

describe("envelope and block parsers", () => {
  it("keeps path, type and original size", () => {
    const text = envelope({
      path: "C:\\\\a\\\\whale.webp",
      kind: "image",
      original: { mediaType: "image/webp", width: 420, height: 418, bytes: 103088 },
      image: { width: 240, height: 238 },
    });
    const block = {
      kind: "result",
      argsRaw: JSON.stringify({ file_path: "C:\\\\a\\\\whale.webp" }),
      content: [
        { type: "text", text },
        { type: "image", attachment: { attachmentId: "att-1", mediaType: "image/webp", width: 240, height: 238 } },
      ],
    };
    assert.equal(parseCallPath(block), "C:\\\\a\\\\whale.webp");
    assert.deepEqual(parseOriginalMeta(block), {
      mediaType: "image/webp",
      width: 420,
      height: 418,
      bytes: 103088,
      kind: "image",
    });
    assert.equal(extractImage(block).attachmentId, "att-1");
  });

  it("falls back to <path> when argsRaw is missing", () => {
    const text = envelope({
      path: "/tmp/clip.mp4",
      kind: "video",
      original: { mediaType: "video/mp4", width: 0, height: 0, bytes: 12 },
    });
    const block = { kind: "result", content: [{ type: "text", text }] };
    assert.equal(parseCallPath(block), "/tmp/clip.mp4");
    assert.equal(parseOriginalMeta(block).kind, "video");
  });
});

describe("bytesToBase64", () => {
  it("matches Buffer for short payloads", () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    assert.equal(bytesToBase64(bytes), Buffer.from(bytes).toString("base64"));
  });
});

describe("package shape", () => {
  it("declares a dsh.bundle patch and a web client", async () => {
    const raw = await readFile(new URL("../package.json", import.meta.url), "utf8");
    const pkg = JSON.parse(raw);
    assert.equal(pkg.dsh.bundle.patch, "./cordis.patch.yml");
    assert.equal(pkg.dsh.client.platform, "web");
    assert.equal(pkg.exports["./client"].default, "./lib/client.js");
  });

  it("registers an authenticated exact fetch route without direct webServer injection", async () => {
    const source = await readFile(new URL("../lib/index.js", import.meta.url), "utf8");
    assert.match(source, /export const inject = \["tools", "fs", "connection"\]/);
    assert.match(source, /ctx\.connection\.fetch\.register\(\{/);
    assert.match(source, /path: FETCH_PATH/);
    assert.doesNotMatch(source, /rpc\.handle/);
    assert.doesNotMatch(source, /"webServer"/);
    assert.match(source, /ctx\.get\("systemPrompt"\)\?\.section/);
    assert.doesNotMatch(source, /ctx\.systemPrompt/);
  });

  it("loads original media from the same-origin api route", async () => {
    const source = await readFile(new URL("../lib/client.js", import.meta.url), "utf8");
    assert.match(source, /const FETCH_PATH = "\/api\/dsh-show-media"/);
    assert.match(source, /fetch\(FETCH_PATH, \{/);
    assert.doesNotMatch(source, /rpc\.call/);
  });

  it("reads image attachments through the remote session API before bindings", async () => {
    const source = await readFile(new URL("../lib/client.js", import.meta.url), "utf8");
    assert.match(source, /remoteSession\.attachment\(\{ sessionId: sessionId, attachmentId: attachmentId \}\)/);
    assert.match(source, /if \(attachmentId\) \{/);
    assert.match(source, /remote: remote/);
    assert.match(source, /const inject = \["slots", "remote", "remote\.session"\]/);
  });

  it("keeps full-size previews square while card thumbnails stay rounded", async () => {
    const source = await readFile(new URL("../lib/client.js", import.meta.url), "utf8");
    assert.match(source, /\.dsm-pic,\.dsm-vid\{[^\n]*border-radius:8px/);
    assert.equal((source.match(/border-radius:0/g) || []).length, 2);
    assert.doesNotMatch(source, /max-width:98vw[^\n]*border-radius:12px/);
  });
});
