// dsh-show-media — host half.
// Registers dsh_show_media so the agent can put a local image or short video
// into the current conversation card. Preview bytes use Connection's exact
// authenticated Fetch route (original file, not attachment normalization).

import { defineTool } from "@deepseek-ai/dsh-tools";
import {
  DEFAULT_IMAGE_CAP,
  DEFAULT_VIDEO_CAP,
  FETCH_PATH,
  TOOL_NAME,
  baseName,
  bytesToBase64,
  envelope,
  kindFor,
  parseDims,
} from "./media.js";

export const name = "dsh-show-media";
// Exact Connection Fetch routes live on the already-mounted authenticated
// /api channel and do not require this plugin to inject webServer directly.
// Keep systemPrompt optional via ctx.get() below.
export const inject = ["tools", "fs", "connection"];

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

function registerMediaRoute(ctx) {
  return ctx.connection.fetch.register({
    path: FETCH_PATH,
    methods: ["POST"],
    requestBody: "buffered",
    fetch: async (request) => {
      let rawPayload;
      try {
        rawPayload = await request.json();
      } catch {
        return Response.json({ ok: false, error: "body is not JSON" }, { status: 400 });
      }
      const filePath = rawPayload && typeof rawPayload === "object"
        ? String(rawPayload.file_path || "").trim()
        : "";
      if (!filePath) {
        return Response.json({ ok: false, error: "file_path is required" }, { status: 400 });
      }
      try {
        const orig = await readOriginal(ctx, filePath, { signal: request.signal });
        return Response.json({
          ok: true,
          path: orig.target.displayPath,
          kind: orig.kind,
          mediaType: orig.mediaType,
          width: orig.width,
          height: orig.height,
          bytes: orig.bytes,
          name: orig.name,
          data: bytesToBase64(orig.data),
        }, { headers: { "cache-control": "no-store" } });
      } catch (err) {
        return Response.json({
          ok: false,
          error: err && err.message ? err.message : String(err),
        }, { status: 422, headers: { "cache-control": "no-store" } });
      }
    }
  });
}

export function apply(ctx) {
  ctx.effect(() => registerMediaRoute(ctx), "dsh-show-media: fetch route");

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
