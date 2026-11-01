(() => {
  "use strict";

  // Keep the source page fully readable without JavaScript. Enhance headings
  // only after all of the elements needed for a section have been found.
  const sections = new Map();
  // Give a fresh landing page substance, without opening unrelated content
  // ahead of a requested catalogue or deep link. This does not change the URL.
  const initialParameters = new URLSearchParams(window.location.search);
  const overviewArrival = (!window.location.hash || window.location.hash === "#top") &&
    initialParameters.get("pubs") !== "full" && initialParameters.get("talks") !== "full";
  const ordinaryActivation = (event) =>
    event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

  document.querySelectorAll("[data-section]").forEach((section) => {
    if (section.dataset.sectionCollapsible !== undefined) return;
    const inner = section.querySelector(".site-section__inner");
    const header = inner?.querySelector(".section-heading");
    const heading = header?.querySelector("h2");
    if (!inner || !header || !heading || !section.id || !heading.id) return;

    const following = Array.from(inner.childNodes).slice(Array.from(inner.childNodes).indexOf(header) + 1);
    const introductions = Array.from(header.querySelectorAll(".section-heading__introduction"));
    const dialogs = Array.from(inner.querySelectorAll("dialog"));
    const content = document.createElement("div");
    content.id = `${section.id}-content`;
    content.className = "section-content";
    content.dataset.sectionContent = "";
    if (introductions.length) content.dataset.hasIntroduction = "true";
    introductions.forEach((introduction, index) => {
      if (index === introductions.length - 1) introduction.dataset.sectionIntroductionLast = "";
      content.append(introduction);
    });
    following.forEach((node) => {
      if (!dialogs.includes(node)) content.append(node);
    });
    inner.append(content);
    // The E-mail popup can be opened from the masthead even when Misc is shut.
    // Modal dialogs must not inherit a hidden ancestor from any section.
    dialogs.forEach((dialog) => inner.append(dialog));

    const button = document.createElement("button");
    button.className = "section-toggle";
    button.type = "button";
    button.dataset.sectionToggle = "";
    button.setAttribute("aria-controls", content.id);
    button.append(...Array.from(heading.childNodes));
    const indicator = document.createElement("span");
    indicator.className = "section-toggle__indicator";
    indicator.setAttribute("aria-hidden", "true");
    button.append(indicator);
    heading.append(button);

    const setOpen = (open) => {
      content.hidden = !open;
      section.dataset.sectionOpen = String(open);
      button.setAttribute("aria-expanded", String(open));
    };
    section.dataset.sectionCollapsible = "";
    button.addEventListener("click", () => {
      setOpen(content.hidden);
    });
    setOpen(overviewArrival && section.id === "research");
    sections.set(section.id, { section, content, button, setOpen });
  });

  if (!sections.size) return;

  const revealTarget = (target) => {
    const section = target?.closest?.("[data-section]");
    const disclosure = section && sections.get(section.id);
    if (!disclosure) return null;
    disclosure.setOpen(true);
    return disclosure.section;
  };

  const fragmentId = (hash) => {
    const raw = hash.replace(/^#/, "");
    try { return decodeURIComponent(raw); }
    catch (_error) { return raw; }
  };

  const revealLocation = ({ initial = false } = {}) => {
    const identifier = fragmentId(window.location.hash);
    if (identifier) {
      const section = revealTarget(document.getElementById(identifier));
      if (section && initial) {
        window.dispatchEvent(new CustomEvent("site:section-request", {
          detail: { id: section.id, anchor: identifier },
        }));
      }
      return;
    }
    const parameters = new URLSearchParams(window.location.search);
    const requested = parameters.get("pubs") === "full" ? "publications"
      : parameters.get("talks") === "full" ? "talks" : "";
    const disclosure = sections.get(requested);
    if (!disclosure) return;
    disclosure.setOpen(true);
    if (initial) {
      // main.js owns reading-index navigation and scrolling. Its deferred script
      // runs first; its scheduled scroll runs after the catalogue scripts.
      window.dispatchEvent(new CustomEvent("site:section-request", { detail: { id: requested } }));
    }
  };

  // Reveal before native fragment scrolling, including a repeat click on the
  // same hash (which would not produce another hashchange event).
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || !ordinaryActivation(event)) return;
    const link = event.target.closest?.("a[href]");
    if (!link || link.hasAttribute("download")) return;
    const target = link.getAttribute("target");
    if (target && target.toLowerCase() !== "_self") return;
    let destination;
    let current;
    try {
      current = new URL(window.location.href);
      destination = new URL(link.getAttribute("href"), current);
    } catch (_error) { return; }
    if (destination.origin !== current.origin || destination.pathname !== current.pathname || !destination.hash) return;
    revealTarget(document.getElementById(fragmentId(destination.hash)));
  }, true);

  window.addEventListener("hashchange", () => revealLocation());
  window.addEventListener("popstate", () => revealLocation());
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) revealLocation();
  });
  revealLocation({ initial: true });
})();
