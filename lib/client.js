// dsh-show-media — browser half.
// Loaded by dsh-client-modules through window.__ModuleLoader__.
// Occupies tool.call.toolview for dsh_show_media only.

window.__ModuleLoader__.load({
  id: "dsh-show-media",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const React = require("react");

    const TOOL_NAME = "dsh_show_media";
    const RPC_CHANNEL = "/dsh-show-media";

    const CSS = [
      ".dsm-card{display:flex;flex-direction:column;gap:8px;margin:4px 0 8px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l2, var(--dsw-alias-border-l1));border-radius:12px;background:var(--dsw-alias-bg-layer-1, var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);max-width:100%;}",
      ".dsm-meta{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);word-break:break-all;}",
      ".dsm-hit{appearance:none;border:0;padding:0;margin:0;background:transparent;display:block;max-width:100%;cursor:zoom-in;text-align:left;}",
      ".dsm-pic,.dsm-vid{display:block;max-width:100%;width:auto;height:auto;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);}",
      ".dsm-vid{max-height:360px;}",
      ".dsm-err{font-size:12px;color:var(--dsw-alias-state-error-primary, var(--dsw-alias-label-primary));}",
      ".dsm-wait{font-size:12px;color:var(--dsw-alias-label-secondary);}",
      ".dsm-hint{font-size:11px;color:var(--dsw-alias-label-secondary);}",
    ].join("");

    function installStyles() {
      const id = "dsh-show-media-css";
      if (typeof document === "undefined") return () => {};
      if (document.querySelector('style[data-plugin-css="' + id + '"]')) return () => {};
      const tag = document.createElement("style");
      tag.dataset.plugin = "dsh-show-media";
      tag.dataset.pluginCss = id;
      tag.textContent = CSS;
      document.head.appendChild(tag);
      return () => {
        if (tag.parentNode) tag.parentNode.removeChild(tag);
      };
    }

    function parseCallPath(block) {
      if (!block || typeof block !== "object") return "";
      const candidates = [block.argsRaw];
      if (block.call && typeof block.call === "object") candidates.push(block.call.argsRaw);
      for (let i = 0; i < candidates.length; i++) {
        const raw = candidates[i];
        if (typeof raw === "string" && raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed.file_path === "string" && parsed.file_path.trim()) {
              return parsed.file_path.trim();
            }
          } catch (err) {}
        } else if (raw && typeof raw === "object" && typeof raw.file_path === "string" && raw.file_path.trim()) {
          return raw.file_path.trim();
        }
      }
      if (Array.isArray(block.content)) {
        for (let i = 0; i < block.content.length; i++) {
          const item = block.content[i];
          if (!item || item.type !== "text" || typeof item.text !== "string") continue;
          const m = item.text.match(/<path>([\s\S]*?)<\/path>/);
          if (m && m[1].trim()) return m[1].trim();
        }
      }
      return "";
    }

    function extractImage(block) {
      if (!block || typeof block !== "object" || !("kind" in block)) return null;
      if (!Array.isArray(block.content)) return null;
      for (let i = 0; i < block.content.length; i++) {
        const item = block.content[i];
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

    function parseOriginalMeta(block) {
      if (!block || typeof block !== "object" || !("kind" in block)) return null;
      if (!Array.isArray(block.content)) return null;
      let mediaKind = "";
      let meta = null;
      for (let i = 0; i < block.content.length; i++) {
        const item = block.content[i];
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
      meta.kind = mediaKind === "video" || (meta.mediaType && meta.mediaType.indexOf("video/") === 0) ? "video" : "image";
      return meta;
    }

    function closeLightboxDom(node) {
      if (node && node.parentNode) node.parentNode.removeChild(node);
    }

    function MediaCard(props) {
      const block = props.block;
      const sessionId = props.sessionId;
      const image = extractImage(block);
      const origMeta = parseOriginalMeta(block);
      const path = parseCallPath(block);
      const srcPair = React.useState("");
      const errPair = React.useState("");
      const openPair = React.useState(false);
      const kindPair = React.useState(origMeta && origMeta.kind ? origMeta.kind : "image");
      const src = srcPair[0];
      const err = errPair[0];
      const open = openPair[0];
      const mediaKind = kindPair[0];
      const attachmentId = image ? image.attachmentId : "";
      const rpc = props.rpc;

      React.useEffect(function () {
        srcPair[1]("");
        errPair[1]("");
        if (origMeta && origMeta.kind) kindPair[1](origMeta.kind);
        if (!path && !attachmentId) return undefined;
        let cancelled = false;
        let objectUrl = "";

        function useBlob(bytes, mediaType, kind) {
          const blob = new Blob([bytes], { type: mediaType || (kind === "video" ? "video/mp4" : "image/png") });
          objectUrl = URL.createObjectURL(blob);
          if (cancelled) {
            URL.revokeObjectURL(objectUrl);
            return;
          }
          if (kind) kindPair[1](kind);
          srcPair[1](objectUrl);
        }

        function fallbackAttachment() {
          if (!attachmentId || !sessionId) {
            if (!cancelled) errPair[1]("no readable original file");
            return;
          }
          const sessions = props.sessions;
          const binding = sessions && sessions.binding(sessionId);
          const session = binding && binding.session;
          if (!session) {
            if (!cancelled) errPair[1]("session is not bound");
            return;
          }
          session.readAttachment(attachmentId).then(function (result) {
            if (cancelled) return;
            if (!result || result.ok !== true) {
              errPair[1](result && result.error && result.error.message ? result.error.message : "failed to read attachment");
              return;
            }
            const mediaType = result.value.attachment && result.value.attachment.mediaType
              ? result.value.attachment.mediaType
              : "image/png";
            useBlob(result.value.data, mediaType, "image");
          }).catch(function (error) {
            if (!cancelled) errPair[1](error && error.message ? error.message : "failed to read media");
          });
        }

        if (!path || !rpc || typeof rpc.call !== "function") {
          fallbackAttachment();
          return function () {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
          };
        }

        rpc.call(RPC_CHANNEL, "load", { file_path: path }).then(function (payload) {
          if (cancelled) return;
          if (!payload || payload.ok !== true || typeof payload.data !== "string") {
            fallbackAttachment();
            return;
          }
          const bin = atob(payload.data);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const kind = payload.kind === "video" || (typeof payload.mediaType === "string" && payload.mediaType.indexOf("video/") === 0)
            ? "video"
            : "image";
          useBlob(bytes, payload.mediaType, kind);
        }).catch(function () {
          if (!cancelled) fallbackAttachment();
        });

        return function () {
          cancelled = true;
          if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
      }, [sessionId, attachmentId, path]);

      React.useEffect(function () {
        if (!open || !src) return undefined;
        const root = document.createElement("div");
        root.setAttribute("data-dsm-lb", sessionId || "");
        root.style.cssText = "position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:12px;box-sizing:border-box;";
        const mask = document.createElement("div");
        mask.style.cssText = "position:absolute;inset:0;background:var(--dsw-alias-bg-mask-1, rgba(0,0,0,.72));";
        mask.addEventListener("mousedown", function () { openPair[1](false); });
        const media = document.createElement(mediaKind === "video" ? "video" : "img");
        media.src = src;
        if (mediaKind === "video") {
          media.controls = true;
          media.autoplay = true;
          media.style.cssText = "position:relative;max-width:98vw;max-height:96vh;width:auto;height:auto;object-fit:contain;border-radius:12px;box-shadow:var(--dsw-shadow-lv3, 0 8px 32px rgba(0,0,0,.35));background:#000;";
        } else {
          media.alt = path || "image";
          media.style.cssText = "position:relative;max-width:98vw;max-height:96vh;width:auto;height:auto;object-fit:contain;border-radius:12px;box-shadow:var(--dsw-shadow-lv3, 0 8px 32px rgba(0,0,0,.35));cursor:zoom-out;background:var(--dsw-alias-bg-base);";
          media.addEventListener("click", function (event) {
            event.stopPropagation();
            openPair[1](false);
          });
        }
        const close = document.createElement("button");
        close.type = "button";
        close.setAttribute("aria-label", "Close preview");
        close.textContent = "×";
        close.style.cssText = "position:fixed;top:16px;right:16px;z-index:1;width:40px;height:40px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2, var(--dsw-alias-border-l1));background:var(--dsw-alias-bg-layer-1, var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);cursor:pointer;font-size:22px;line-height:38px;";
        close.addEventListener("click", function () { openPair[1](false); });
        root.appendChild(mask);
        root.appendChild(media);
        root.appendChild(close);
        document.body.appendChild(root);
        function onKey(event) {
          if (event.key === "Escape") openPair[1](false);
        }
        window.addEventListener("keydown", onKey);
        return function () {
          window.removeEventListener("keydown", onKey);
          if (mediaKind === "video" && media.pause) media.pause();
          closeLightboxDom(root);
        };
      }, [open, src, path, sessionId, mediaKind]);

      const settled = block && typeof block === "object" && ("kind" in block);
      const failed = settled && block.isError === true;
      const shownW = origMeta && origMeta.width ? origMeta.width : (image && image.width);
      const shownH = origMeta && origMeta.height ? origMeta.height : (image && image.height);
      const size = shownW && shownH ? shownW + "×" + shownH : "";
      const meta = [path || (image && image.name) || (mediaKind === "video" ? "video" : "image"), size].filter(Boolean).join(" · ");
      const isVideo = mediaKind === "video";

      return React.createElement(
        "div",
        { className: "dsm-card" },
        React.createElement("div", { className: "dsm-meta" }, meta),
        failed ? React.createElement("div", { className: "dsm-err" }, "failed to show media") : null,
        err ? React.createElement("div", { className: "dsm-err" }, err) : null,
        src ? React.createElement(
          "button",
          {
            type: "button",
            className: "dsm-hit",
            title: isVideo ? "Click the frame for a larger preview" : "Click to preview original",
            onClick: function () { openPair[1](true); },
          },
          isVideo
            ? React.createElement("video", {
              className: "dsm-vid",
              src: src,
              controls: true,
              preload: "metadata",
              onClick: function (event) { event.stopPropagation(); },
            })
            : React.createElement("img", {
              className: "dsm-pic",
              src: src,
              alt: path || "image",
            }),
        ) : (!failed && !err ? React.createElement("div", { className: "dsm-wait" }, settled ? "Loading original…" : "Reading…") : null),
        src ? React.createElement("div", { className: "dsm-hint" }, isVideo ? "Click the frame for a larger preview · Esc closes" : "Click to preview original · Esc closes") : null,
      );
    }

    const inject = ["slots"];

    function apply(ctx) {
      ctx.effect(() => installStyles(), "dsh-show-media: styles");
      const connection = ctx.get("connection");
      const sessions = ctx.get("sessions");
      const rpc = connection && connection.rpc;
      ctx.slots.inject("tool.call.toolview", () => ctx.slots.register(
        { name: "tool.call.toolview", key: TOOL_NAME },
        function BoundCard(props) {
          return React.createElement(MediaCard, Object.assign({}, props, { rpc: rpc, sessions: sessions }));
        },
      ));
    }

    exports.apply = apply;
    exports.inject = inject;
    exports.name = "dsh-show-media";
    return module.exports;
  },
});
