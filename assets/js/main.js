(() => {
  "use strict";

  const root = document.documentElement;
  const navigation = document.querySelector("[data-topic-nav]");
  const navigationItems = document.querySelector("[data-topic-nav-items]");
  const closeButton = document.querySelector("[data-topic-nav-close]");
  const sectionLinks = Array.from(document.querySelectorAll("[data-section-link]"));
  const overviewLinks = Array.from(document.querySelectorAll("[data-overview-link]"));
  const sections = Array.from(document.querySelectorAll("[data-section]"));
  const status = document.querySelector("[data-nav-status]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const railBreakpoint = window.matchMedia("(min-width: 1100px)");
  const topCollapseThreshold = 32;
  const topCollapseArmDistance = 96;

  if (!navigation || !navigationItems || sectionLinks.length === 0) return;

  let exploring = root.classList.contains("is-exploring");
  let activeSection = "";
  let scrollFrame = 0;
  let focusTimer = 0;
  let topCollapseArmed = false;

  navigation.dataset.mode = exploring ? (railBreakpoint.matches ? "rail" : "strip") : "grid";
  if (closeButton) closeButton.hidden = false;

  const ordinaryActivation = (event) =>
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey;

  const sectionForId = (id) =>
    sections.find((section) => section.id === id) || null;

  const idFromHash = () => {
    const raw = window.location.hash.replace(/^#/, "");
    try {
      return decodeURIComponent(raw);
    } catch (_error) {
      return raw;
    }
  };

  const snapshot = () =>
    new Map(sectionLinks.map((link) => [link, link.getBoundingClientRect()]));

  const animateAssembly = (before) => {
    if (reducedMotion.matches || typeof Element.prototype.animate !== "function") return;

    sectionLinks.forEach((link) => {
      const first = before.get(link);
      const last = link.getBoundingClientRect();
      if (!first || !last.width || !last.height) return;

      const deltaX = first.left - last.left;
      const deltaY = first.top - last.top;
      const distance = Math.hypot(deltaX, deltaY);
      if (distance < 2) return;

      link.getAnimations().forEach((animation) => animation.cancel());
      link.animate(
        [
          {
            transform: `translate(${deltaX}px, ${deltaY}px)`,
            opacity: 0.76,
          },
          { transform: "translate(0, 0)", opacity: 1 },
        ],
        {
          duration: 380,
          easing: "cubic-bezier(0.2, 0.78, 0.2, 1)",
        },
      );
    });
  };

  const setExploring = (next, { animate = true, announce = true } = {}) => {
    if (exploring === next) return;

    const before = animate ? snapshot() : null;
    exploring = next;
    topCollapseArmed = false;
    root.classList.toggle("is-exploring", next);
    navigation.dataset.mode = next ? (railBreakpoint.matches ? "rail" : "strip") : "grid";

    if (before) animateAssembly(before);

    if (announce && status) {
      status.textContent = next
        ? "Section panes assembled into the reading index."
        : "Returned to the overview grid.";
    }
  };

  const revealActiveLink = (id) => {
    if (railBreakpoint.matches || !exploring) return;
    const activeLink = sectionLinks.find((link) => link.dataset.sectionLink === id);
    if (!activeLink) return;

    const targetLeft =
      activeLink.offsetLeft - navigationItems.clientWidth / 2 + activeLink.clientWidth / 2;
    navigationItems.scrollTo({
      left: Math.max(0, targetLeft),
      behavior: reducedMotion.matches ? "auto" : "smooth",
    });
  };

  const setActiveSection = (id, { forceReveal = false } = {}) => {
    if (!id) return;
    if (id === activeSection) {
      if (forceReveal) revealActiveLink(id);
      return;
    }
    activeSection = id;

    sectionLinks.forEach((link) => {
      const current = link.dataset.sectionLink === id;
      if (current) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });

    revealActiveLink(id);
  };

  const updateActiveFromScroll = () => {
    scrollFrame = 0;
    if (!exploring || sections.length === 0) return;

    if (!topCollapseArmed && window.scrollY > topCollapseArmDistance) {
      topCollapseArmed = true;
    } else if (topCollapseArmed && window.scrollY <= topCollapseThreshold) {
      collapseAtPageTop();
      return;
    }

    const readingLine = Math.min(window.innerHeight * 0.32, 280);
    let candidate = sections[0];

    for (const section of sections) {
      const box = section.getBoundingClientRect();
      if (box.top <= readingLine) candidate = section;
      if (box.top <= readingLine && box.bottom > readingLine) {
        candidate = section;
        break;
      }
    }

    setActiveSection(candidate.id);
  };

  const queueActiveUpdate = () => {
    if (scrollFrame) return;
    scrollFrame = window.requestAnimationFrame(updateActiveFromScroll);
  };

  const pushLocation = (id) => {
    const currentId = idFromHash();
    const url = new URL(window.location.href);
    if (id !== "publications") {
      url.searchParams.delete("pubs");
      url.searchParams.delete("pubs-by");
    }
    if (id !== "talks") {
      url.searchParams.delete("talks");
      url.searchParams.delete("talks-by");
    }
    url.hash = id ? encodeURIComponent(id) : "";

    const nextLocation = `${url.pathname}${url.search}${url.hash}`;
    const currentLocation = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const sameSection = (id && currentId === id) || (!id && (!currentId || currentId === "top"));
    if (sameSection && nextLocation === currentLocation) return;

    window.history.pushState({ section: id || null }, "", nextLocation);
  };

  const cancelPendingFocus = () => {
    if (!focusTimer) return;
    window.clearTimeout(focusTimer);
    focusTimer = 0;
  };

  const replaceWithOverviewLocation = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("pubs");
    url.searchParams.delete("pubs-by");
    url.searchParams.delete("talks");
    url.searchParams.delete("talks-by");
    url.hash = "";
    const nextLocation = `${url.pathname}${url.search}`;
    const priorState =
      window.history.state && typeof window.history.state === "object"
        ? window.history.state
        : {};
    window.history.replaceState({ ...priorState, section: null }, "", nextLocation);
  };

  const collapseAtPageTop = () => {
    cancelPendingFocus();
    setExploring(false, { announce: false });
    activeSection = "";
    sectionLinks.forEach((link) => link.removeAttribute("aria-current"));
    replaceWithOverviewLocation();
    window.dispatchEvent(new CustomEvent("site:overview"));
    if (status) status.textContent = "Returned to the overview grid at the top of the page.";
  };

  const focusSectionHeading = (section, id) => {
    const heading = section.querySelector("h2[tabindex='-1']");
    if (!heading) return;
    cancelPendingFocus();
    focusTimer = window.setTimeout(() => {
      focusTimer = 0;
      if (!exploring || activeSection !== id || !heading.isConnected) return;
      heading.focus({ preventScroll: true });
    }, reducedMotion.matches ? 0 : 520);
  };

  const moveToSection = (id, { updateHistory = true, focus = true } = {}) => {
    const section = sectionForId(id);
    if (!section) return;

    cancelPendingFocus();
    setExploring(true);
    setActiveSection(id);
    if (updateHistory) pushLocation(id);

    window.requestAnimationFrame(() => {
      section.scrollIntoView({
        behavior: reducedMotion.matches ? "auto" : "smooth",
        block: "start",
      });
      if (focus) focusSectionHeading(section, id);
    });
  };

  const returnToOverview = ({ updateHistory = true, focus = false } = {}) => {
    cancelPendingFocus();
    setExploring(false, { animate: false });
    activeSection = "";
    sectionLinks.forEach((link) => link.removeAttribute("aria-current"));
    if (updateHistory) pushLocation("");
    window.dispatchEvent(new CustomEvent("site:overview"));

    window.requestAnimationFrame(() => {
      document.getElementById("top")?.scrollIntoView({
        behavior: reducedMotion.matches ? "auto" : "smooth",
        block: "start",
      });
      if (focus) document.querySelector(".hero h1")?.focus?.({ preventScroll: true });
    });
  };

  const dismissNavigation = ({ focus = false } = {}) => {
    const currentSection = sectionForId(activeSection);
    const focusTarget = currentSection?.querySelector("h2[tabindex='-1']");
    const viewportAnchor = currentSection || sections[0];
    const anchorTop = viewportAnchor?.getBoundingClientRect().top;

    cancelPendingFocus();
    setExploring(false, { animate: false, announce: false });
    activeSection = "";
    sectionLinks.forEach((link) => link.removeAttribute("aria-current"));

    /*
     * Restoring the overview puts its eight-pane grid back into document flow.
     * Hold the reading section at the same viewport position across that reflow.
     * Measuring after the class change also makes this safe when native scroll
     * anchoring has already supplied some or all of the correction.
     */
    if (viewportAnchor?.isConnected && Number.isFinite(anchorTop)) {
      const anchorShift = viewportAnchor.getBoundingClientRect().top - anchorTop;
      if (Number.isFinite(anchorShift) && Math.abs(anchorShift) >= 0.5) {
        const priorScrollBehavior = root.style.scrollBehavior;
        root.style.scrollBehavior = "auto";
        window.scrollTo({
          left: window.scrollX,
          top: Math.max(0, window.scrollY + anchorShift),
          behavior: "auto",
        });
        root.style.scrollBehavior = priorScrollBehavior;
      }
    }

    if (status) {
      status.textContent = "Section navigation closed.";
    }

    if (focus && focusTarget) {
      window.requestAnimationFrame(() => {
        if (focusTarget.isConnected) focusTarget.focus({ preventScroll: true });
      });
    }
  };

  sectionLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      if (!ordinaryActivation(event)) return;
      const id = link.dataset.sectionLink;
      if (!sectionForId(id)) return;
      event.preventDefault();
      moveToSection(id);
    });

    link.addEventListener("focus", () => {
      if (!railBreakpoint.matches && exploring) {
        link.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    });
  });

  overviewLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      if (!ordinaryActivation(event)) return;
      event.preventDefault();
      returnToOverview({ focus: event.detail === 0 });
    });
  });

  closeButton?.addEventListener("click", (event) => {
    dismissNavigation({ focus: event.detail === 0 });
  });

  const syncFromLocation = ({ scroll = false } = {}) => {
    cancelPendingFocus();
    const id = idFromHash();
    if (sectionForId(id)) {
      setExploring(true, { animate: false, announce: false });
      setActiveSection(id);
      if (scroll) {
        window.requestAnimationFrame(() => {
          sectionForId(id)?.scrollIntoView({ behavior: "auto", block: "start" });
        });
      }
    } else if (!id || id === "top") {
      setExploring(false, { animate: false, announce: false });
      activeSection = "";
      sectionLinks.forEach((link) => link.removeAttribute("aria-current"));
      if (scroll) {
        window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
      }
    } else {
      const target = document.getElementById(id);
      if (target) {
        const parentSection = target.closest("[data-section]");
        if (parentSection) {
          setExploring(true, { animate: false, announce: false });
          setActiveSection(parentSection.id);
        }
        if (scroll) {
          window.requestAnimationFrame(() => {
            target.scrollIntoView({ behavior: "auto", block: "start" });
            queueActiveUpdate();
          });
        }
      }
    }
  };

  window.addEventListener("scroll", queueActiveUpdate, { passive: true });
  window.addEventListener("resize", queueActiveUpdate, { passive: true });
  window.addEventListener("popstate", () => {
    syncFromLocation({ scroll: idFromHash() !== activeSection });
  });
  window.addEventListener("hashchange", () => syncFromLocation({ scroll: true }));
  window.addEventListener("site:section-request", (event) => {
    const id = event.detail?.id;
    if (!sectionForId(id)) return;
    if (event.detail.anchor && event.detail.anchor === idFromHash()) {
      syncFromLocation({ scroll: true });
    } else {
      moveToSection(id, { updateHistory: false, focus: false });
    }
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) queueActiveUpdate();
  });

  document.addEventListener("keydown", cancelPendingFocus, true);
  document.addEventListener("pointerdown", cancelPendingFocus, true);
  document.addEventListener("wheel", cancelPendingFocus, { capture: true, passive: true });
  document.addEventListener("touchstart", cancelPendingFocus, { capture: true, passive: true });

  railBreakpoint.addEventListener?.("change", () => {
    if (exploring) navigation.dataset.mode = railBreakpoint.matches ? "rail" : "strip";
    if (activeSection) setActiveSection(activeSection, { forceReveal: true });
    queueActiveUpdate();
  });

  syncFromLocation();
  queueActiveUpdate();
})();
