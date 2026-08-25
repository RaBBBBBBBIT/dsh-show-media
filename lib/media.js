/** Shared media typing and header parsing. No Node or Cordis imports. */

export const IMAGE_EXTS = Object.freeze({
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
});

export const VIDEO_EXTS = Object.freeze({
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".m4v": "video/mp4",
  ".mkv": "video/x-matroska",
});

export const DEFAULT_IMAGE_CAP = 20 * 1024 * 1024;
export const DEFAULT_VIDEO_CAP = 64 * 1024 * 1024;
export const TOOL_NAME = "dsh_show_media";
export const RPC_CHANNEL = "/dsh-show-media";

export function extname(path) {
  const s = String(path || "");
  const slash = Math.max(s.lastIndexOf("/"), s.lastIndexOf("\\"));
  const base = slash >= 0 ? s.slice(slash + 1) : s;
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot).toLowerCase() : "";
}

export function baseName(path) {
  const s = String(path || "");
  const i = Math.max(s.lastIndexOf("/"), s.lastIndexOf("\\"));
  return i >= 0 ? s.slice(i + 1) : s;
}

export function kindFor(path) {
  const ext = extname(path);
  if (IMAGE_EXTS[ext]) return { kind: "image", mediaType: IMAGE_EXTS[ext] };
  if (VIDEO_EXTS[ext]) return { kind: "video", mediaType: VIDEO_EXTS[ext] };
  return undefined;
}

function u16(bytes, i) {
  return (bytes[i] << 8) | bytes[i + 1];
}

function u32(bytes, i) {
  return ((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]) >>> 0;
}

export function parseDims(bytes, mediaType) {
  const n = bytes.length;
  if (mediaType === "image/png" && n >= 24 && bytes[0] === 137 && bytes[1] === 80) {
    return { width: u32(bytes, 16), height: u32(bytes, 20) };
  }
  if (mediaType === "image/gif" && n >= 10 && bytes[0] === 71 && bytes[1] === 73) {
    return { width: bytes[6] | (bytes[7] << 8), height: bytes[8] | (bytes[9] << 8) };
  }
  if (mediaType === "image/jpeg" && n >= 4 && bytes[0] === 255 && bytes[1] === 216) {
    let i = 2;
    while (i + 8 < n) {
      if (bytes[i] !== 255) {
        i += 1;
        continue;
      }
      const marker = bytes[i + 1];
      if (marker === 192 || marker === 193 || marker === 194) {
        return { width: u16(bytes, i + 7), height: u16(bytes, i + 5) };
      }
      const len = u16(bytes, i + 2);
      if (len < 2) break;
      i += 2 + len;
    }
  }
  if (mediaType === "image/webp" && n >= 30) {
    const tag = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
    if (tag === "VP8X") {
      return {
        width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
        height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16),
      };
    }
    if (tag === "VP8 ") {
      return {
        width: bytes[26] + ((bytes[27] & 63) << 8),
        height: bytes[28] + ((bytes[29] & 63) << 8),
      };
    }
    if (tag === "VP8L" && n >= 25) {
      const b0 = bytes[21];
      const b1 = bytes[22];
      const b2 = bytes[23];
      const b3 = bytes[24];
      return {
        width: 1 + (b0 + ((b1 & 63) << 8)),
        height: 1 + ((b1 >> 6) + (b2 << 2) + ((b3 & 15) << 10)),
      };
    }
  }
  return { width: 0, height: 0 };
}

export function bytesToBase64(bytes) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const len = bytes.length;
  let out = "";
  let i = 0;
  while (i + 2 < len) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += chars[(n >> 18) & 63] + chars[(n >> 12) & 63] + chars[(n >> 6) & 63] + chars[n & 63];
    i += 3;
  }
  if (i < len) {
    const a = bytes[i];
    const b = i + 1 < len ? bytes[i + 1] : 0;
    const n = (a << 16) | (b << 8);
    out += chars[(n >> 18) & 63] + chars[(n >> 12) & 63];
    out += i + 1 < len ? chars[(n >> 6) & 63] : "=";
    out += "=";
  }
  return out;
}

export function envelope(value) {
  const orig = value.original || {};
  let extra = `${orig.mediaType || "application/octet-stream"} ${orig.width || 0}x${orig.height || 0} px, ${orig.bytes || 0} bytes`;
  const img = value.image;
  if (img && (img.width !== orig.width || img.height !== orig.height)) {
    extra += ` (attachment ${img.width}x${img.height})`;
  }
  return `<path>${value.path}</path>\n<type>${value.kind}</type>\n<content>\n${extra}\n</content>`;
}

export function parseCallPath(block) {
  if (!block || typeof block !== "object") return "";
  const candidates = [block.argsRaw];
  if (block.call && typeof block.call === "object") candidates.push(block.call.argsRaw);
  for (const raw of candidates) {
    if (typeof raw === "string" && raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.file_path === "string" && parsed.file_path.trim()) {
          return parsed.file_path.trim();
        }
      } catch {
        // ignore malformed args
      }
    } else if (raw && typeof raw === "object" && typeof raw.file_path === "string" && raw.file_path.trim()) {
      return raw.file_path.trim();
    }
  }
  if (Array.isArray(block.content)) {
    for (const item of block.content) {
      if (!item || item.type !== "text" || typeof item.text !== "string") continue;
      const m = item.text.match(/<path>([\s\S]*?)<\/path>/);
      if (m && m[1].trim()) return m[1].trim();
    }
  }
  return "";
}

export function parseOriginalMeta(block) {
  if (!block || typeof block !== "object" || !("kind" in block)) return null;
  const content = block.content;
  if (!Array.isArray(content)) return null;
  let mediaKind = "";
  let meta = null;
  for (const item of content) {
    if (!item || item.type !== "text" || typeof item.text !== "string") continue;
    const k = item.text.match(/<type>([\s\S]*?)<\/type>/);
    if (k) mediaKind = k[1].trim();
    const m = item.text.match(/([a-z]+\/[a-z0-9.+-]+) (\d+)x(\d+) px, (\d+) bytes/i);
    if (m) {
      meta = {
        mediaType: m[1],
        width: Number(m[2]),
        height: Number(m[3]),
        bytes: Number(m[4]),
      };
    }
  }
  if (!meta) return null;
  meta.kind = mediaKind === "video" || (meta.mediaType && meta.mediaType.startsWith("video/")) ? "video" : "image";
  return meta;
}

export function extractImage(block) {
  if (!block || typeof block !== "object" || !("kind" in block)) return null;
  if (!Array.isArray(block.content)) return null;
  for (const item of block.content) {
    if (!item || item.type !== "image" || !item.attachment) continue;
    const att = item.attachment;
    if (typeof att.attachmentId !== "string" || !att.attachmentId) continue;
    return {
      attachmentId: att.attachmentId,
      mediaType: typeof att.mediaType === "string" ? att.mediaType : "image/png",
      width: att.width,
      height: att.height,
      bytes: att.bytes,
      name: typeof att.name === "string" ? att.name : "",
    };
  }
  return null;
}
