(function () {
  "use strict";
  var doc = document, win = window, root = doc.documentElement;
  var script = doc.currentScript;
  var reader = script && script.getAttribute("data-gabbay-html-progress") === "reader";
  var hash = win.location.hash.slice(1);
  try { hash = decodeURIComponent(hash); } catch (_) { /* Keep malformed hashes unchanged. */ }
  if (!root || (reader && /^pdf:/i.test(hash)) || win.__gabbayHTMLProgress) return;
  win.__gabbayHTMLProgress = true;

  var loading = "data-gabbay-html-loading", mounted = "data-gabbay-html-progress-body";
  var status = null, observer = null, active = false, expiry = 0, scheduled = null;
  var busy = null, busyValue = null;
  var style = doc.createElement("style");
  style.textContent =
    "html[" + loading + "]:not([" + mounted + "])::before,#gabbay-html-progress-status{" +
    "box-sizing:border-box;position:fixed;z-index:2147483646;top:calc(12px + env(safe-area-inset-top));right:12px;" +
    "max-width:calc(100vw - 24px);padding:10px 36px 10px 12px;border:1px solid #aeb8c4;border-radius:8px;" +
    "background:#fff;color:#243346;font:14px/1.4 system-ui,sans-serif;box-shadow:0 2px 12px #0002;pointer-events:none}" +
    "html[" + loading + "]:not([" + mounted + "])::before{content:attr(" + loading + ")}" +
    "html[" + loading + "]:not([" + mounted + "])::after,#gabbay-html-progress-status::before{" +
    "content:'';box-sizing:border-box;width:14px;height:14px;border:2px solid #536b84;border-right-color:transparent;" +
    "border-radius:50%;animation:gabbay-html-spin .8s linear infinite;will-change:transform;pointer-events:none}" +
    "html[" + loading + "]:not([" + mounted + "])::after{position:fixed;z-index:2147483647;" +
    "top:calc(25px + env(safe-area-inset-top));right:24px}" +
    "#gabbay-html-progress-status::before{position:absolute;right:12px;top:calc(50% - 7px)}" +
    "#gabbay-html-progress-status[hidden]{display:none!important}" +
    "@keyframes gabbay-html-spin{to{transform:rotate(1turn)}}" +
    "@media(prefers-reduced-motion:reduce){html[" + loading + "]::after,#gabbay-html-progress-status::before{animation:none}}" +
    "@media print{html[" + loading + "]::before,html[" + loading + "]::after,#gabbay-html-progress-status{display:none!important}}";
  (doc.head || root).appendChild(style);

  function mount() {
    if (!doc.body) return;
    if (observer) { observer.disconnect(); observer = null; }
    if (!status) {
      status = doc.createElement("div");
      status.id = "gabbay-html-progress-status";
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      status.setAttribute("aria-atomic", "true");
      status.setAttribute("data-copy-skip", "");
      status.hidden = true;
      doc.body.appendChild(status);
    }
    if (active) {
      status.textContent = root.getAttribute(loading);
      status.hidden = false;
      root.setAttribute(mounted, "");
    }
  }

  function restoreBusy() {
    if (!busy) return;
    if (busyValue === null) busy.removeAttribute("aria-busy");
    else busy.setAttribute("aria-busy", busyValue);
    busy = null;
  }

  function hide() {
    active = false;
    win.clearTimeout(expiry);
    root.removeAttribute(loading);
    root.removeAttribute(mounted);
    if (status) { status.hidden = true; status.textContent = ""; }
    if (observer) { observer.disconnect(); observer = null; }
    restoreBusy();
  }

  function reset() {
    if (scheduled) { scheduled(); scheduled = null; }
    hide();
  }

  function show(message) {
    active = true;
    root.setAttribute(loading, message);
    mount();
    if (!doc.body && !observer && win.MutationObserver) {
      observer = new win.MutationObserver(mount);
      observer.observe(root, { childList: true });
    }
    win.clearTimeout(expiry);
    // A slow reader transfer can legitimately take minutes; only the outgoing page times out.
    if (!reader) expiry = win.setTimeout(hide, 20000);
  }

  // Two frame callbacks allow a paint opportunity; the timer also works in throttled tabs.
  function afterPaint(callback) {
    var done = false, first = 0, second = 0;
    var timer = win.setTimeout(run, 200);
    function cancel() {
      done = true;
      win.clearTimeout(timer);
      if (win.cancelAnimationFrame) {
        win.cancelAnimationFrame(first);
        win.cancelAnimationFrame(second);
      }
    }
    function run() { if (!done) { cancel(); callback(); } }
    if (win.requestAnimationFrame) {
      first = win.requestAnimationFrame(function () {
        if (!done) second = win.requestAnimationFrame(run);
      });
    }
    return cancel;
  }

  win.addEventListener("pageshow", function (event) { if (event.persisted) reset(); });
  win.addEventListener("pagehide", reset);
  win.addEventListener("beforeprint", reset);
  doc.addEventListener("keydown", function (event) { if (event.key === "Escape") reset(); });

  if (reader) {
    show("Loading reading edition…");
    function parsed() {
      if (!active) return;
      show("Preparing reading edition…");
      if (scheduled) scheduled();
      scheduled = afterPaint(function () { scheduled = null; hide(); });
    }
    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", parsed, { once: true });
    else parsed();
    return;
  }

  mount();
  doc.addEventListener("click", function (event) {
    if (event.defaultPrevented) { reset(); return; }
    var target = event.target;
    if (target && !target.closest) target = target.parentElement;
    var anchor = target && target.closest && target.closest("a[href]");
    if (!anchor) return;
    // A different navigation must never be overtaken by an older delayed click.
    reset();
    var base = doc.querySelector && doc.querySelector("base[target]");
    var frame = anchor.getAttribute("target") || (base && base.getAttribute("target")) || "";
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey ||
        anchor.hasAttribute("download") || (frame && frame.toLowerCase() !== "_self") ||
        anchor.hasAttribute("referrerpolicy") || anchor.hasAttribute("ping") || anchor.hasAttribute("attributionsrc") ||
        (anchor.getAttribute("rel") || "").trim() ||
        !anchor.closest(".publication__links") || !/^\s*Experimental\s+html\b/i.test(anchor.textContent)) return;
    var url, current;
    try { url = new URL(anchor.href, doc.baseURI); current = new URL(win.location.href); }
    catch (_) { return; }
    if (!/^(https?:|file:)$/.test(url.protocol) || url.origin !== current.origin ||
        !/\/papers\/.+\.html$/i.test(url.pathname) ||
        (url.pathname === current.pathname && url.search === current.search)) return;
    event.preventDefault();
    busy = anchor;
    busyValue = anchor.getAttribute("aria-busy");
    anchor.setAttribute("aria-busy", "true");
    show("Opening reading edition…");
    var destination = url.href;
    scheduled = afterPaint(function () {
      scheduled = null;
      try { win.location.assign(destination); }
      catch (_) { hide(); }
    });
  });
}());
