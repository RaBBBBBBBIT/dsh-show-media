// dsh-show-media — host half.
// Registers dsh_show_media so the agent can put a local image or short video
// into the current conversation card. Preview bytes go over a fenced RPC
// (original file, not the official attachment normalize path).

import { defineTool } from "@deepseek-ai/dsh-tools";
import {
  DEFAULT_IMAGE_CAP,
  DEFAULT_VIDEO_CAP,
  RPC_CHANNEL,
  TOOL_NAME,
  baseName,
  bytesToBase64,
  envelope,
  kindFor,
  parseDims,
} from "./media.js";

export const name = "dsh-show-media";
// `webServer` is required by the Connection RPC registrar: the registrar
// binds the channel to the caller's context.  Keep `systemPrompt` optional
// via ctx.get() below so older compositions without that service can still
// load the tool instead of failing the whole plugin tree.
export const inject = ["tools", "fs", "connection", "webServer"];

const TOOL_DESCRIPTION = [
  "Show a local image or a short local video in the current conversation card.",
  "Images: PNG/JPEG/WebP/GIF. Videos: MP4/WebM/MOV/M4V/MKV (64MiB cap).",
  "The card can preview the original file. This is for the human, not the model.",
  "Model vision still uses the official read_image tool.",
].join(" ");

const ORIGINAL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: true,
  properties: {
    mediaType: { type: "string", required: true },
    bytes: { type: "integer", required: true },
    width: { type: "integer", required: true },
    height: { type: "integer", required: true },
    name: { type: "string" },
  },
};

const IMAGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    attachmentId: { type: "string", required: true },
    mediaType: { type: "string", required: true },
    bytes: { type: "integer", required: true },
    width: { type: "integer", required: true },
    height: { type: "integer", required: true },
    name: { type: "string" },
  },
};

async function readOriginal(ctx, filePath, exec) {
  const path = String(filePath || "").trim();
  if (!path) throw new Error("file_path is required");
  const typed = kindFor(path);
  if (typed === undefined) {
    throw new Error("only PNG/JPEG/WebP/GIF or MP4/WebM/MOV/M4V/MKV are accepted");
  }
  const header = exec && exec.agent && exec.agent.session && exec.agent.session.header;
  const cwd = header && header.cwd;
  const opts = {};
  if (cwd) opts.cwd = cwd;
  if (exec && exec.signal) opts.signal = exec.signal;
  const target = await ctx.fs.resolve(path, opts);
  const info = await ctx.fs.stat(target, exec && exec.signal);
  if (info === undefined) throw new Error(`file not found: ${target.displayPath}`);
  const attachments = ctx.get("attachments");
  const imageCap = attachments && attachments.imageLimits && typeof attachments.imageLimits.maxImageBytes === "number"
    ? attachments.imageLimits.maxImageBytes
    : DEFAULT_IMAGE_CAP;
  const cap = typed.kind === "video" ? DEFAULT_VIDEO_CAP : imageCap;
  const data = await ctx.fs.readBytes(target, exec && exec.signal, cap);
  const dims = typed.kind === "image" ? parseDims(data, typed.mediaType) : { width: 0, height: 0 };
  return {
    target,
    kind: typed.kind,
    mediaType: typed.mediaType,
    data,
    width: dims.width,
    height: dims.height,
    bytes: data.length,
    name: baseName(target.displayPath),
  };
}

function registerRpc(ctx) {
  const connection = ctx.get("connection");
  if (connection === undefined || !connection.rpc || typeof connection.rpc.handle !== "function") {
    return () => {};
  }
  return connection.rpc.handle(RPC_CHANNEL, async (endpoint, rawPayload) => {
    if (endpoint !== "load") {
      return { ok: false, error: "unknown endpoint" };
    }
    const filePath = rawPayload && typeof rawPayload === "object"
      ? String(rawPayload.file_path || "").trim()
      : "";
    if (!filePath) return { ok: false, error: "file_path is required" };
    try {
      const orig = await readOriginal(ctx, filePath);
      return {
        ok: true,
        path: orig.target.displayPath,
        kind: orig.kind,
        mediaType: orig.mediaType,
        width: orig.width,
        height: orig.height,
        bytes: orig.bytes,
        name: orig.name,
        data: bytesToBase64(orig.data),
      };
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : String(err) };
    }
  });
}

export function apply(ctx) {
  ctx.effect(() => registerRpc(ctx), "dsh-show-media: rpc");

  // Access optional services through get(). Direct property access is
  // validated by Cordis against the plugin's inject list and caused
  // `cannot get property "systemPrompt" without inject` on newer DSH.
  ctx.get("systemPrompt")?.section?.({
    name: "tool:dsh-show-media",
    order: 140,
    text: "When the user should see a local image or video in the conversation, call dsh_show_media. Do not rely on markdown file paths. Official read_image remains the model-vision path.",
  });

  ctx.tools.register(defineTool({
    name: TOOL_NAME,
    description: TOOL_DESCRIPTION,
    parameters: {
      file_path: {
        type: "string",
        required: true,
        description: "Local image or video path. Relative paths resolve against the session workspace.",
      },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          path: { type: "string", required: true },
          kind: { type: "string", required: true },
          original: ORIGINAL_SCHEMA,
          image: IMAGE_SCHEMA,
        },
      },
      render(args, value) {
        const blocks = [{ type: "text", text: envelope(value) }];
        if (value.image && value.image.attachmentId) {
          blocks.push({ type: "image", attachment: value.image });
        }
        return blocks;
      },
    },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const orig = await readOriginal(ctx, args && args.file_path, exec);
      const original = {
        mediaType: orig.mediaType,
        bytes: orig.bytes,
        width: orig.width,
        height: orig.height,
        name: orig.name,
      };
      const result = {
        path: orig.target.displayPath,
        kind: orig.kind,
        original,
      };
      if (orig.kind !== "image") return result;
      const attachments = ctx.get("attachments");
      if (attachments === undefined) return result;
      if (Array.isArray(attachments.imageLimits?.mediaTypes)
        && attachments.imageLimits.mediaTypes.indexOf(orig.mediaType) < 0) {
        throw new Error(`${orig.mediaType} is not accepted by this deployment`);
      }
      const ref = await attachments.saveImage({
        data: orig.data,
        mediaType: orig.mediaType,
        name: orig.name,
      });
      const image = {
        attachmentId: String(ref.attachmentId),
        mediaType: ref.mediaType,
        bytes: ref.bytes,
        width: ref.width,
        height: ref.height,
      };
      if (typeof ref.name === "string" && ref.name) image.name = ref.name;
      if (!original.width) original.width = ref.width;
      if (!original.height) original.height = ref.height;
      result.image = image;
      return result;
    },
  }));
}
