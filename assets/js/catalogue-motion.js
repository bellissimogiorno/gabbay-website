(() => {
  "use strict";

  // State changes remain immediate. Motion only introduces the resulting list;
  // it never holds old content in place or waits before updating links/focus.
  const running = new Map();
  const stop = (target) => {
    const animation = running.get(target);
    if (!animation) return;
    running.delete(target);
    try { animation.cancel(); } catch (_error) { /* Motion is optional. */ }
  };
  const motionAllowed = () => {
    try {
      return typeof window.matchMedia === "function" &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
        !window.matchMedia("print").matches;
    } catch (_error) { return false; }
  };

  const reveal = (target) => {
    if (!target) return;
    stop(target);
    if (!motionAllowed() || typeof target.animate !== "function") return;
    try {
      const animation = target.animate(
        [
          { opacity: 0.35, transform: "translateY(3px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        { duration: 180, easing: "ease-out" },
      );
      running.set(target, animation);
      const done = () => {
        if (running.get(target) === animation) running.delete(target);
      };
      // A cancelled animation rejects finished; consume both outcomes. A stale
      // completion must not clear the next animation from a rapid second click.
      animation.finished?.then(done, done);
    } catch (_error) { /* Keep the newly selected view without motion. */ }
  };

  const change = (catalogue, update, { animate = true } = {}) => {
    const result = update();
    if (result === false || !animate || !catalogue) return result;
    const panels = Array.from(catalogue.querySelectorAll(
      "[data-publication-scope-panel], [data-talk-scope-panel]",
    ));
    reveal(panels.find((panel) => !panel.hidden) || catalogue);
    return result;
  };
  change.reveal = reveal;
  window.gabbayCatalogueMotion = change;
  const stopAll = () => Array.from(running.keys()).forEach(stop);
  window.addEventListener("beforeprint", stopAll);
  try {
    window.matchMedia?.("(prefers-reduced-motion: reduce)").addEventListener?.("change", (event) => {
      if (event.matches) stopAll();
    });
  } catch (_error) { /* Older browsers still check the preference each time. */ }
})();
