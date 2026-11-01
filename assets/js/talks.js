(() => {
  "use strict";

  const talks = document.querySelector("[data-talks]");
  if (!talks) return;

  const fallbackNavigation = talks.querySelector("[data-talk-fallback]");
  const scopeTablist = talks.querySelector("[data-talk-scope-tablist]");
  const scopeTabs = Array.from(talks.querySelectorAll("[data-talk-scope-tab]"));
  const scopePanels = Array.from(talks.querySelectorAll("[data-talk-scope-panel]"));
  const viewTablist = talks.querySelector("[data-talk-view-tablist]");
  const viewTabs = Array.from(talks.querySelectorAll("[data-talk-view-tab]"));
  const viewPanels = Array.from(talks.querySelectorAll("[data-talk-view-panel]"));
  const fullPanel = talks.querySelector('[data-talk-scope-panel="full"]');
  const talkItems = fullPanel
    ? Array.from(fullPanel.querySelectorAll("[data-talk-item]"))
    : [];
  const originalTalkOrder = new Map(
    talkItems.map((item, index) => [item, index]),
  );
  const talkCount = talks.querySelector("[data-talk-count]");

  if (
    !fallbackNavigation ||
    !scopeTablist ||
    scopeTabs.length !== 2 ||
    scopePanels.length !== 2 ||
    !viewTablist ||
    viewTabs.length !== 4 ||
    viewPanels.length !== 4 ||
    !fullPanel
  ) {
    return;
  }

  if (typeof Element.prototype.replaceChildren !== "function") return;

  const validScopes = new Set(["selected", "full"]);
  const validViews = new Set(["date", "topic", "title", "type"]);
  const talkAnchorSelector = ".talk-entry[id], [data-talk-alias]";
  const viewDescriptions = {
    date: "date",
    topic: "topic",
    title: "title",
    type: "type",
  };
  const collator = new Intl.Collator("en-GB", {
    sensitivity: "base",
    numeric: true,
  });
  const state = { scope: "selected", view: "date" };
  let renderedView = "date";

  const itemValue = (item, name) => (item.dataset[name] || "").trim();

  const decodedHash = () => {
    const raw = window.location.hash.replace(/^#/, "");
    try {
      return decodeURIComponent(raw);
    } catch (_error) {
      return raw;
    }
  };

  const stateFromLocation = () => {
    const parameters = new URLSearchParams(window.location.search);
    let scope = parameters.get("talks") === "full" ? "full" : "selected";
    let view = parameters.get("talks-by") || "date";
    const hash = decodedHash();
    const hashTarget = hash ? document.getElementById(hash) : null;
    const targetsTalks =
      !hash ||
      hash === "talks" ||
      hash === "selected-talks" ||
      hash === "full-talks" ||
      Boolean(hashTarget && fullPanel.contains(hashTarget));

    if (!targetsTalks) {
      return {
        scope: "selected",
        view: "date",
        targetsTalks: false,
        talkAnchor: null,
      };
    }

    if (hash === "full-talks" || (hashTarget && fullPanel.contains(hashTarget))) {
      scope = "full";
      view = "date";
    } else if (hash === "selected-talks") {
      scope = "selected";
    }

    if (!validViews.has(view) || scope !== "full") view = "date";
    return {
      scope,
      view,
      targetsTalks: true,
      talkAnchor:
        hashTarget &&
        (scopePanels.includes(hashTarget) ||
          (fullPanel.contains(hashTarget) &&
            hashTarget.matches(talkAnchorSelector)))
          ? hashTarget
          : null,
    };
  };

  const tabValue = (tab, kind) => tab.dataset[kind];

  const updateTabset = ({ tabs, panels, tabDataName, panelDataName, value }) => {
    tabs.forEach((tab) => {
      const selected = tabValue(tab, tabDataName) === value;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });

    panels.forEach((panel) => {
      panel.hidden = panel.dataset[panelDataName] !== value;
    });
  };

  const focusTab = (tabs, index) => {
    const nextTab = tabs[(index + tabs.length) % tabs.length];
    tabs.forEach((tab) => {
      tab.tabIndex = tab === nextTab ? 0 : -1;
    });
    nextTab.focus();
    nextTab.scrollIntoView({ block: "nearest", inline: "nearest" });
    return nextTab;
  };

  const installKeyboardNavigation = (tablist, tabs) => {
    tablist.addEventListener("keydown", (event) => {
      const currentIndex = tabs.indexOf(event.target);
      if (currentIndex < 0) return;

      let nextIndex = null;
      if (event.key === "ArrowLeft") nextIndex = currentIndex - 1;
      if (event.key === "ArrowRight") nextIndex = currentIndex + 1;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = tabs.length - 1;
      if (nextIndex === null) return;

      event.preventDefault();
      event.stopPropagation();
      focusTab(tabs, nextIndex).click();
    });
  };

  const configureTabset = ({ tablist, tabs, panels, tabDataName, panelDataName }) => {
    tablist.setAttribute("role", "tablist");
    tablist.setAttribute("aria-orientation", "horizontal");

    tabs.forEach((tab) => {
      const value = tabValue(tab, tabDataName);
      const panel = panels.find((candidate) => candidate.dataset[panelDataName] === value);
      tab.setAttribute("role", "tab");
      if (!panel) return;
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", tab.id);
      panel.tabIndex = 0;
    });

    installKeyboardNavigation(tablist, tabs);
  };

  // Ignore opening punctuation and an initial article for alphabetical order.
  // The displayed titles are unchanged.
  const titleKey = (item) =>
    itemValue(item, "talkTitle")
      .replace(/^[^\p{L}\p{N}]+/u, "")
      .replace(/^(a|an|the)\s+/i, "")
      .replace(/^[^\p{L}\p{N}]+/u, "")
      .trim();

  const talkTimestamp = (item) => {
    const rawDate = itemValue(item, "talkDate");
    const rawYear = itemValue(item, "talkYear");
    if (/forthcoming|in press/i.test(`${rawDate} ${rawYear}`)) {
      return Number.MAX_SAFE_INTEGER;
    }

    const parsedDate = Date.parse(rawDate);
    if (Number.isFinite(parsedDate)) return parsedDate;

    const parsedYear = Number.parseInt(rawYear, 10);
    return Number.isFinite(parsedYear) ? Date.UTC(parsedYear, 0, 1) : Number.MIN_SAFE_INTEGER;
  };

  const compareTitles = (left, right) => collator.compare(titleKey(left), titleKey(right));

  const compareDates = (left, right) => {
    const difference = talkTimestamp(right) - talkTimestamp(left);
    return difference || originalTalkOrder.get(left) - originalTalkOrder.get(right);
  };

  const groupValue = (item, view) => {
    if (view === "date") {
      return itemValue(item, "talkYear") || "Forthcoming and undated";
    }
    if (view === "topic") return itemValue(item, "talkTopic") || "Other";
    if (view === "type") return itemValue(item, "talkType") || "Other";

    const firstCharacter = titleKey(item).match(/[A-Z]/i)?.[0];
    return firstCharacter ? firstCharacter.toUpperCase() : "0–9";
  };

  const sortedItems = (view) => {
    const items = [...talkItems];
    if (view === "title") return items.sort(compareTitles);
    if (view === "date") return items.sort(compareDates);

    return items.sort((left, right) => {
      const groupDifference = collator.compare(groupValue(left, view), groupValue(right, view));
      return groupDifference || compareDates(left, right);
    });
  };

  const slug = (value) => {
    const normalized = value
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return normalized || "other";
  };

  const buildGroups = (view) => {
    const groups = new Map();
    sortedItems(view).forEach((item) => {
      const key = groupValue(item, view);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });

    const groupsContainer = document.createElement("div");
    groupsContainer.className = "talk-groups";
    groupsContainer.dataset.talkGroups = "";

    let groupIndex = 0;
    groups.forEach((items, label) => {
      const group = document.createElement("section");
      const heading = document.createElement("h4");
      const list = document.createElement("ol");
      const headingId = `talk-${view}-group-${slug(label)}-${groupIndex}`;
      groupIndex += 1;

      group.className = "talk-group";
      group.setAttribute("aria-labelledby", headingId);
      heading.className = "talk-group__title";
      heading.id = headingId;
      heading.textContent = label;
      list.className = "talk-list";
      items.forEach((item) => list.append(item));

      group.append(heading, list);
      groupsContainer.append(group);
    });

    return groupsContainer;
  };

  const renderView = (view) => {
    const target = viewPanels.find((panel) => panel.dataset.talkViewPanel === view);
    if (!target) return false;
    if (renderedView === view && target.querySelectorAll("[data-talk-item]").length === talkItems.length) {
      return true;
    }

    const priorPanelContents = new Map(
      viewPanels.map((panel) => [panel, Array.from(panel.childNodes)]),
    );
    const priorItemPositions = talkItems.map((item) => ({
      item,
      parent: item.parentNode,
      nextSibling: item.nextSibling,
    }));

    const restorePriorView = () => {
      priorPanelContents.forEach((children, panel) => panel.replaceChildren(...children));
      [...priorItemPositions].reverse().forEach(({ item, parent, nextSibling }) => {
        if (!parent) return;
        if (nextSibling && nextSibling.parentNode === parent) parent.insertBefore(item, nextSibling);
        else parent.append(item);
      });
    };

    try {
      let nextContent;
      if (talkItems.length) {
        nextContent = buildGroups(view);
      } else {
        const emptyMessage = document.createElement("p");
        emptyMessage.className = "talk-empty";
        emptyMessage.textContent = "The complete talks list is being prepared.";
        nextContent = emptyMessage;
      }

      viewPanels.forEach((panel) => panel.replaceChildren());
      target.append(nextContent);
      renderedView = view;
      return true;
    } catch (error) {
      restorePriorView();
      console.error(`The talks could not be arranged by ${view}.`, error);
      return false;
    }
  };

  const updateCount = () => {
    if (!talkCount) return;
    const noun = talkItems.length === 1 ? "item" : "items";
    talkCount.textContent = `${talkItems.length} ${noun}, arranged by ${viewDescriptions[state.view]}.`;
  };

  const applyState = (nextScope, nextView = "date") => {
    const resolvedScope = validScopes.has(nextScope) ? nextScope : "selected";
    const resolvedView =
      resolvedScope === "full" && validViews.has(nextView) ? nextView : "date";

    const changed = state.scope !== resolvedScope || state.view !== resolvedView;
    const update = () => {
      if (resolvedScope === "full" && !renderView(resolvedView)) return false;

      state.scope = resolvedScope;
      state.view = resolvedView;

      updateTabset({
        tabs: scopeTabs,
        panels: scopePanels,
        tabDataName: "talkScopeTab",
        panelDataName: "talkScopePanel",
        value: state.scope,
      });
      updateTabset({
        tabs: viewTabs,
        panels: viewPanels,
        tabDataName: "talkViewTab",
        panelDataName: "talkViewPanel",
        value: state.view,
      });
      updateCount();
      return true;
    };
    return typeof window.gabbayCatalogueMotion === "function"
      ? window.gabbayCatalogueMotion(talks, update, {
        animate: talks.dataset.enhanced === "true" && changed,
      })
      : update();
  };

  const writeLocation = (method = "pushState") => {
    const url = new URL(window.location.href);
    if (state.scope === "full") {
      url.searchParams.set("talks", "full");
      if (state.view === "date") url.searchParams.delete("talks-by");
      else url.searchParams.set("talks-by", state.view);
    } else {
      url.searchParams.delete("talks");
      url.searchParams.delete("talks-by");
    }
    url.hash = "talks";

    const nextLocation = `${url.pathname}${url.search}${url.hash}`;
    const currentLocation = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextLocation === currentLocation) return;

    const priorState =
      window.history.state && typeof window.history.state === "object"
        ? window.history.state
        : {};
    window.history[method](
      { ...priorState, talks: { scope: state.scope, view: state.view } },
      "",
      nextLocation,
    );
  };

  const activateScope = (scope, { updateHistory = true } = {}) => {
    if (scope === state.scope) return;
    if (!applyState(scope, "date")) return;
    if (updateHistory) writeLocation();
  };

  const activateView = (view, { updateHistory = true } = {}) => {
    if (state.scope === "full" && view === state.view) return;
    if (!applyState("full", view)) return;
    if (updateHistory) writeLocation();
  };

  const clearTalkParameters = () => {
    const url = new URL(window.location.href);
    const hadParameters = url.searchParams.has("talks") || url.searchParams.has("talks-by");
    url.searchParams.delete("talks");
    url.searchParams.delete("talks-by");
    if (!hadParameters) return;

    const priorState =
      window.history.state && typeof window.history.state === "object"
        ? window.history.state
        : {};
    window.history.replaceState(
      { ...priorState, talks: { scope: "selected", view: "date" } },
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  };

  const synchronizeFromLocation = ({ restoreAnchor = false } = {}) => {
    const nextState = stateFromLocation();
    const applied = applyState(nextState.scope, nextState.view);
    if (!nextState.targetsTalks) clearTalkParameters();
    if (applied && restoreAnchor && nextState.talkAnchor) {
      window.requestAnimationFrame(() => {
        nextState.talkAnchor.scrollIntoView({ behavior: "auto", block: "start" });
      });
    }
    return applied;
  };

  const restoreFallback = () => {
    renderView("date");
    fallbackNavigation.hidden = false;
    scopeTablist.hidden = true;
    viewTablist.hidden = true;
    scopePanels.forEach((panel) => {
      panel.hidden = false;
      panel.removeAttribute("role");
      panel.removeAttribute("tabindex");
    });
    viewPanels.forEach((panel) => {
      panel.hidden = panel.dataset.talkViewPanel !== "date";
      panel.removeAttribute("role");
      panel.removeAttribute("tabindex");
    });
  };

  try {
    configureTabset({
      tablist: scopeTablist,
      tabs: scopeTabs,
      panels: scopePanels,
      tabDataName: "talkScopeTab",
      panelDataName: "talkScopePanel",
    });
    configureTabset({
      tablist: viewTablist,
      tabs: viewTabs,
      panels: viewPanels,
      tabDataName: "talkViewTab",
      panelDataName: "talkViewPanel",
    });

    scopeTabs.forEach((tab) => {
      tab.addEventListener("click", () => activateScope(tab.dataset.talkScopeTab));
    });
    viewTabs.forEach((tab) => {
      tab.addEventListener("click", () => activateView(tab.dataset.talkViewTab));
    });

    if (!synchronizeFromLocation({ restoreAnchor: true })) {
      throw new Error("The requested talk view could not be prepared.");
    }
    fallbackNavigation.hidden = true;
    scopeTablist.hidden = false;
    viewTablist.hidden = false;
    talks.dataset.enhanced = "true";
  } catch (error) {
    restoreFallback();
    console.error("The talk controls could not be initialized.", error);
    return;
  }

  window.addEventListener("popstate", () => {
    synchronizeFromLocation({ restoreAnchor: true });
  });

  window.addEventListener("hashchange", () => {
    synchronizeFromLocation({ restoreAnchor: true });
  });

  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    synchronizeFromLocation();
  });

  window.addEventListener("site:overview", () => {
    applyState("selected", "date");
    clearTalkParameters();
  });

  document.addEventListener(
    "click",
    (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const link = event.target.closest?.("a[href]");
      if (!link || link.hasAttribute("download")) return;
      const linkTarget = link.getAttribute("target");
      if (linkTarget && linkTarget.toLowerCase() !== "_self") return;

      let destination;
      let current;
      try {
        destination = new URL(link.getAttribute("href"), window.location.href);
        current = new URL(window.location.href);
      } catch (_error) {
        return;
      }
      if (
        destination.origin !== current.origin ||
        destination.pathname !== current.pathname ||
        !destination.hash
      ) {
        return;
      }

      let identifier;
      try {
        identifier = decodeURIComponent(destination.hash.slice(1));
      } catch (_error) {
        identifier = destination.hash.slice(1);
      }
      const target = document.getElementById(identifier);
      if (
        !target ||
        !fullPanel.contains(target) ||
        (target !== fullPanel && !target.matches(talkAnchorSelector))
      ) {
        return;
      }

      // Reveal the record before native fragment navigation, including a second
      // click on the same fragment (which does not fire another hashchange).
      applyState("full", "date");
    },
    true,
  );

  document.addEventListener("click", (event) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const sectionLink = event.target.closest?.("[data-section-link]");
    if (sectionLink && sectionLink.dataset.sectionLink !== "talks") {
      applyState("selected", "date");
    }
  });

  // Keep the chosen view while the reader scrolls into another section. Only an
  // explicit navigation action should collapse the long catalogue.
})();
