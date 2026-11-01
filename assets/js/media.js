/* Keep the original image sources and expose a readable state if loading fails. */
(() => {
  "use strict";

  document.querySelectorAll("img").forEach((image) => {
    const wrapper = image.parentElement;
    if (!wrapper) return;

    const originalHidden = image.hidden;
    let fallback = null;

    const restore = () => {
      if (!fallback) return;
      fallback.remove();
      fallback = null;
      image.hidden = originalHidden;
      if (!wrapper.querySelector(".media-fallback")) {
        wrapper.classList.remove("media-unavailable");
      }
    };

    const showUnavailable = () => {
      if (fallback) return;

      const description = image.getAttribute("alt")?.trim() || "Image";
      const portrait = wrapper.classList.contains("hero__portrait");
      const cover = wrapper.classList.contains("book-cover");
      const label = portrait ? "MJG" : cover ? "Semitopology" : description;
      const status = portrait ? "Portrait unavailable" : cover ? "Cover unavailable" : "Image unavailable";

      fallback = document.createElement("span");
      fallback.className = "media-fallback";
      fallback.setAttribute("role", "img");
      fallback.setAttribute("aria-label", `${description}. ${status}.`);

      const heading = document.createElement("strong");
      heading.className = "media-fallback__label";
      heading.textContent = label;
      heading.setAttribute("aria-hidden", "true");
      const note = document.createElement("span");
      note.className = "media-fallback__status";
      note.textContent = status;
      note.setAttribute("aria-hidden", "true");
      fallback.append(heading, note);

      image.insertAdjacentElement("afterend", fallback);
      image.hidden = true;
      wrapper.classList.add("media-unavailable");
    };

    image.addEventListener("error", showUnavailable);
    image.addEventListener("load", restore);
    // Deferred scripts may run after a cached image has already failed.
    // A pending lazy image is not complete, and must retain its loading state.
    if (image.getAttribute("src") && image.complete && image.naturalWidth === 0) {
      showUnavailable();
    }
  });
})();
