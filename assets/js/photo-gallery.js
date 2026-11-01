/* A local, keyboard-accessible viewer; original image links remain the fallback. */
(() => {
  "use strict";

  const gallerySelector = ".legacy-photo-gallery, .malika-photo-gallery";
  const galleries = [...document.querySelectorAll(gallerySelector)];
  if (!galleries.length) return;

  const dialog = document.createElement("dialog");
  if (typeof dialog.showModal !== "function") return;
  dialog.className = "photo-viewer";
  dialog.setAttribute("aria-label", "Photograph viewer");
  dialog.setAttribute("aria-describedby", "photo-viewer-caption");

  const toolbar = document.createElement("div");
  toolbar.className = "photo-viewer__toolbar";
  const button = (label, className) => {
    const element = document.createElement("button");
    element.type = "button";
    element.className = className;
    element.textContent = label;
    return element;
  };
  const previous = button("Previous", "photo-viewer__previous");
  const next = button("Next", "photo-viewer__next");
  const close = button("Close", "photo-viewer__close");
  previous.setAttribute("aria-label", "Previous photograph");
  next.setAttribute("aria-label", "Next photograph");
  close.setAttribute("aria-label", "Close photograph viewer");
  const position = document.createElement("span");
  position.className = "photo-viewer__position";
  toolbar.append(previous, position, next, close);

  const figure = document.createElement("figure");
  figure.className = "photo-viewer__figure";
  const stage = document.createElement("div");
  stage.className = "photo-viewer__stage";
  const caption = document.createElement("figcaption");
  caption.id = "photo-viewer-caption";
  caption.setAttribute("aria-live", "polite");
  caption.setAttribute("aria-atomic", "true");
  figure.append(stage, caption);

  const footer = document.createElement("div");
  footer.className = "photo-viewer__footer";
  const status = document.createElement("p");
  status.className = "photo-viewer__status";
  status.setAttribute("role", "status");
  const original = document.createElement("a");
  original.className = "photo-viewer__original";
  original.textContent = "Open original image";
  original.target = "_blank";
  original.rel = "noopener";
  footer.append(status, original);
  dialog.append(toolbar, figure, footer);
  document.body.append(dialog);

  let group = [];
  let index = 0;
  let opener = null;
  let generation = 0;

  function imageSource(anchor) {
    const value = anchor.dataset.photoSource || anchor.href;
    let url;
    try { url = new URL(value, document.baseURI); } catch (_) { return null; }
    if (["http:", "https:", "file:", "blob:"].includes(url.protocol)) return url.href;
    if (url.protocol === "data:" && /^data:image\/(?:jpeg|png|gif|webp|avif);/i.test(value)) return value;
    return null;
  }

  function isPhotograph(anchor) {
    if (!anchor.querySelector("img") || anchor.hasAttribute("download")) return false;
    const href = anchor.getAttribute("href") || "";
    let pathname;
    try {
      const url = new URL(href, document.baseURI);
      if (!["http:", "https:", "file:"].includes(url.protocol)) return false;
      pathname = url.pathname;
    } catch (_) {
      // An opaque inline frame can still display the verified full-image data
      // supplied by its review builder. Never manufacture a production origin.
      if (!anchor.dataset.photoSource || /^(?:[a-z][a-z\d+.-]*:|\/\/)|\\/i.test(href.trim())) return false;
      pathname = href.split(/[?#]/, 1)[0];
    }
    return /\.(?:jpe?g|png|gif|webp|avif)$/i.test(pathname) && imageSource(anchor) !== null;
  }

  function groupFor(anchor, gallery) {
    const rel = anchor.getAttribute("rel") || "";
    const named = /^lightbox\[[^\]]*\]$/.test(rel);
    const table = anchor.closest("table");
    return [...gallery.querySelectorAll("a[href]")].filter((candidate) => {
      if (!isPhotograph(candidate)) return false;
      if (named) return candidate.getAttribute("rel") === rel;
      return table ? candidate.closest("table") === table : !candidate.closest("table");
    });
  }

  function render() {
    const anchor = group[index];
    const thumbnail = anchor.querySelector("img");
    const container = anchor.closest(".thumbnail-container");
    const label = container?.querySelector(".thumbnail-name")?.textContent || thumbnail.getAttribute("alt") || "Photograph";
    const words = label.trim().replace(/\s+/g, " ");
    const current = ++generation;
    position.textContent = `${index + 1} / ${group.length}`;
    position.setAttribute("aria-label", `Photograph ${index + 1} of ${group.length}`);
    caption.textContent = words;
    previous.disabled = index === 0;
    next.disabled = index === group.length - 1;
    original.href = anchor.href;
    status.textContent = "Loading photograph…";
    status.hidden = false;
    stage.setAttribute("aria-busy", "true");
    const image = document.createElement("img");
    image.className = "photo-viewer__image";
    image.alt = words;
    image.decoding = "async";
    image.hidden = true;
    image.addEventListener("load", () => {
      if (current !== generation || !dialog.open) return;
      image.hidden = false;
      status.hidden = true;
      stage.setAttribute("aria-busy", "false");
    });
    image.addEventListener("error", () => {
      if (current !== generation || !dialog.open) return;
      status.textContent = "The photograph could not be loaded. You can try the original image link.";
      status.hidden = false;
      stage.setAttribute("aria-busy", "false");
    });
    stage.replaceChildren(image);
    image.src = imageSource(anchor);
  }

  function move(step) {
    const destination = Math.max(0, Math.min(group.length - 1, index + step));
    if (destination !== index) { index = destination; render(); }
  }

  const dismiss = () => { if (dialog.open) dialog.close(); };
  previous.addEventListener("click", () => move(-1));
  next.addEventListener("click", () => move(1));
  close.addEventListener("click", dismiss);
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); dismiss(); });
  dialog.addEventListener("close", () => {
    generation += 1;
    stage.replaceChildren();
    document.documentElement.classList.remove("photo-viewer-open");
    if (opener?.isConnected) opener.focus({preventScroll: true});
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      move(event.key === "ArrowLeft" ? -1 : 1);
    }
  });
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right ||
        event.clientY < box.top || event.clientY > box.bottom) dismiss();
  });

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target.closest?.("a[href]");
    const gallery = anchor?.closest(gallerySelector);
    if (!gallery || !isPhotograph(anchor)) return;
    const photos = groupFor(anchor, gallery);
    const selected = photos.indexOf(anchor);
    if (selected < 0) return;
    try { dialog.showModal(); } catch (_) { return; } // Keep the original link usable if a modal cannot open.
    group = photos;
    index = selected;
    opener = anchor;
    render();
    document.documentElement.classList.add("photo-viewer-open");
    close.focus({preventScroll: true});
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
})();
