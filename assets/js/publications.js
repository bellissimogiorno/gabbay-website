(() => {
  "use strict";

  const publications = document.querySelector("[data-publications]");
  if (!publications) return;

  const fallbackNavigation = publications.querySelector("[data-publication-fallback]");
  const scopeTablist = publications.querySelector("[data-publication-scope-tablist]");
  const scopeTabs = Array.from(publications.querySelectorAll("[data-publication-scope-tab]"));
  const scopePanels = Array.from(publications.querySelectorAll("[data-publication-scope-panel]"));
  const viewTablist = publications.querySelector("[data-publication-view-tablist]");
  const viewTabs = Array.from(publications.querySelectorAll("[data-publication-view-tab]"));
  const viewPanels = Array.from(publications.querySelectorAll("[data-publication-view-panel]"));
  const fullPanel = publications.querySelector('[data-publication-scope-panel="full"]');
  const datePanel = viewPanels.find((panel) => panel.dataset.publicationViewPanel === "date");
  const topicPanel = viewPanels.find((panel) => panel.dataset.publicationViewPanel === "topic");
  const sharedTopics = Boolean(topicPanel?.hasAttribute("data-publication-topic-trial"));
  // Topic cards are intentionally repeated. The normal catalogue remains the
  // source of its unique count, stable paper IDs, and movable sorting nodes.
  const canonicalPanel = sharedTopics ? datePanel : fullPanel;
  const publicationItems = canonicalPanel
    ? Array.from(canonicalPanel.querySelectorAll("[data-publication-item]"))
    : [];
  const sortablePanels = sharedTopics
    ? viewPanels.filter((panel) => panel !== topicPanel)
    : viewPanels;
  const originalPublicationOrder = new Map(
    publicationItems.map((item, index) => [item, index]),
  );
  const publicationCount = publications.querySelector("[data-publication-count]");

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
  const publicationAnchorSelector =
    ".publication[id], .publication__related-version[id], [data-publication-alias]";
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

  const isTopicTarget = (target) => Boolean(
    sharedTopics && target && topicPanel.contains(target),
  );

  const topicGroupFor = (target) => isTopicTarget(target)
    ? target.closest("details[data-publication-topic]")
    : null;

  const topicGroups = sharedTopics
    ? Array.from(topicPanel.querySelectorAll("details[data-publication-topic]"))
    : [];
  const topicMotionPending = new WeakSet();

  const closeOtherTopics = (group) => {
    topicGroups.forEach((other) => {
      if (other !== group && other.open) other.open = false;
    });
  };

  const openTopicGroup = (group) => {
    if (publications.dataset.enhanced === "true" && !group.open) topicMotionPending.add(group);
    closeOtherTopics(group);
    group.open = true;
  };

  topicGroups.forEach((group) => {
    group.querySelector("summary")?.addEventListener("click", (event) => {
      if (event.defaultPrevented || event.button !== 0 || group.open) return;
      // Close the old group before the browser opens this one. Waiting for
      // queued toggle events can otherwise undo a rapid second selection.
      topicMotionPending.add(group);
      closeOtherTopics(group);
    }, true);
    group.addEventListener("toggle", () => {
      if (group.open) {
        closeOtherTopics(group);
        if (topicMotionPending.has(group)) {
          window.gabbayCatalogueMotion?.reveal?.(group.querySelector(".publication-list"));
        }
      }
      topicMotionPending.delete(group);
    });
  });

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
    let scope = parameters.get("pubs") === "full" ? "full" : "selected";
    let view = parameters.get("pubs-by") || "date";
    const hash = decodedHash();
    const hashTarget = hash ? document.getElementById(hash) : null;
    const targetsTopic = isTopicTarget(hashTarget);
    const targetsPublications =
      !hash ||
      hash === "publications" ||
      hash === "selected-publications" ||
      hash === "full-publications" ||
      Boolean(hashTarget && fullPanel.contains(hashTarget));

    if (!targetsPublications) {
      return {
        scope: "selected",
        view: "date",
        targetsPublications: false,
        publicationAnchor: null,
      };
    }

    if (targetsTopic) {
      scope = "full";
      view = "topic";
    } else if (hash === "full-publications" || (hashTarget && fullPanel.contains(hashTarget))) {
      scope = "full";
      view = "date";
    } else if (hash === "selected-publications") {
      scope = "selected";
    }

    if (!validViews.has(view) || scope !== "full") view = "date";
    return {
      scope,
      view,
      targetsPublications: true,
      topicGroup: topicGroupFor(hashTarget),
      publicationAnchor:
        hashTarget &&
        (targetsTopic || scopePanels.includes(hashTarget) ||
          (fullPanel.contains(hashTarget) &&
            hashTarget.matches(publicationAnchorSelector)))
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
    itemValue(item, "publicationTitle")
      .replace(/^[^\p{L}\p{N}]+/u, "")
      .replace(/^(a|an|the)\s+/i, "")
      .replace(/^[^\p{L}\p{N}]+/u, "")
      .trim();

  const publicationTimestamp = (item) => {
    const rawDate = itemValue(item, "publicationDate");
    const rawYear = itemValue(item, "publicationYear");
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
    const difference = publicationTimestamp(right) - publicationTimestamp(left);
    return difference || originalPublicationOrder.get(left) - originalPublicationOrder.get(right);
  };

  const groupValue = (item, view) => {
    if (view === "date") {
      return itemValue(item, "publicationYear") || "Forthcoming and undated";
    }
    if (view === "topic") return itemValue(item, "publicationTopic") || "Other";
    if (view === "type") return itemValue(item, "publicationType") || "Other";

    const firstCharacter = titleKey(item).match(/[A-Z]/i)?.[0];
    return firstCharacter ? firstCharacter.toUpperCase() : "0–9";
  };

  const sortedItems = (view) => {
    const items = [...publicationItems];
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
    groupsContainer.className = "publication-groups";
    groupsContainer.dataset.publicationGroups = "";

    let groupIndex = 0;
    groups.forEach((items, label) => {
      const group = document.createElement("section");
      const heading = document.createElement("h4");
      const list = document.createElement("ol");
      const headingId = `publication-${view}-group-${slug(label)}-${groupIndex}`;
      groupIndex += 1;

      group.className = "publication-group";
      group.setAttribute("aria-labelledby", headingId);
      heading.className = "publication-group__title";
      heading.id = headingId;
      heading.textContent = label;
      list.className = "publication-list";
      items.forEach((item) => list.append(item));

      group.append(heading, list);
      groupsContainer.append(group);
    });

    return groupsContainer;
  };

  const renderView = (view) => {
    const target = viewPanels.find((panel) => panel.dataset.publicationViewPanel === view);
    if (!target) return false;
    // The shared-topic listing is rendered on the server and has its own
    // namespaced cards. Keep its native details and open states intact.
    if (sharedTopics && view === "topic") return true;
    if (renderedView === view && target.querySelectorAll("[data-publication-item]").length === publicationItems.length) {
      return true;
    }

    const priorPanelContents = new Map(
      sortablePanels.map((panel) => [panel, Array.from(panel.childNodes)]),
    );
    const priorItemPositions = publicationItems.map((item) => ({
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
      if (publicationItems.length) {
        nextContent = buildGroups(view);
      } else {
        const emptyMessage = document.createElement("p");
        emptyMessage.className = "publication-empty";
        emptyMessage.textContent = "The complete bibliography is being prepared.";
        nextContent = emptyMessage;
      }

      sortablePanels.forEach((panel) => panel.replaceChildren());
      target.append(nextContent);
      renderedView = view;
      return true;
    } catch (error) {
      restorePriorView();
      console.error(`The publications could not be arranged by ${view}.`, error);
      return false;
    }
  };

  const updateCount = () => {
    if (!publicationCount) return;
    const noun = publicationItems.length === 1 ? "item" : "items";
    publicationCount.textContent = `${publicationItems.length} ${noun}, arranged by ${viewDescriptions[state.view]}.`;
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
        tabDataName: "publicationScopeTab",
        panelDataName: "publicationScopePanel",
        value: state.scope,
      });
      updateTabset({
        tabs: viewTabs,
        panels: viewPanels,
        tabDataName: "publicationViewTab",
        panelDataName: "publicationViewPanel",
        value: state.view,
      });
      updateCount();
      return true;
    };
    return typeof window.gabbayCatalogueMotion === "function"
      ? window.gabbayCatalogueMotion(publications, update, {
        animate: publications.dataset.enhanced === "true" && changed,
      })
      : update();
  };

  const writeLocation = (method = "pushState") => {
    const url = new URL(window.location.href);
    if (state.scope === "full") {
      url.searchParams.set("pubs", "full");
      if (state.view === "date") url.searchParams.delete("pubs-by");
      else url.searchParams.set("pubs-by", state.view);
    } else {
      url.searchParams.delete("pubs");
      url.searchParams.delete("pubs-by");
    }
    url.hash = "publications";

    const nextLocation = `${url.pathname}${url.search}${url.hash}`;
    const currentLocation = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextLocation === currentLocation) return;

    const priorState =
      window.history.state && typeof window.history.state === "object"
        ? window.history.state
        : {};
    window.history[method](
      { ...priorState, publications: { scope: state.scope, view: state.view } },
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

  const clearPublicationParameters = () => {
    const url = new URL(window.location.href);
    const hadParameters = url.searchParams.has("pubs") || url.searchParams.has("pubs-by");
    url.searchParams.delete("pubs");
    url.searchParams.delete("pubs-by");
    if (!hadParameters) return;

    const priorState =
      window.history.state && typeof window.history.state === "object"
        ? window.history.state
        : {};
    window.history.replaceState(
      { ...priorState, publications: { scope: "selected", view: "date" } },
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  };

  const synchronizeFromLocation = ({ restoreAnchor = false } = {}) => {
    const nextState = stateFromLocation();
    const applied = applyState(nextState.scope, nextState.view);
    if (!nextState.targetsPublications) clearPublicationParameters();
    if (applied && nextState.topicGroup) openTopicGroup(nextState.topicGroup);
    if (applied && restoreAnchor && nextState.publicationAnchor) {
      window.requestAnimationFrame(() => {
        const target = nextState.publicationAnchor === nextState.topicGroup
          ? nextState.topicGroup.querySelector("summary") || nextState.topicGroup
          : nextState.publicationAnchor;
        target.scrollIntoView({ behavior: "auto", block: "start" });
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
      panel.hidden = panel.dataset.publicationViewPanel !== "date" &&
        !(sharedTopics && panel === topicPanel);
      panel.removeAttribute("role");
      panel.removeAttribute("tabindex");
    });
  };

  try {
    configureTabset({
      tablist: scopeTablist,
      tabs: scopeTabs,
      panels: scopePanels,
      tabDataName: "publicationScopeTab",
      panelDataName: "publicationScopePanel",
    });
    configureTabset({
      tablist: viewTablist,
      tabs: viewTabs,
      panels: viewPanels,
      tabDataName: "publicationViewTab",
      panelDataName: "publicationViewPanel",
    });

    scopeTabs.forEach((tab) => {
      tab.addEventListener("click", () => activateScope(tab.dataset.publicationScopeTab));
    });
    viewTabs.forEach((tab) => {
      tab.addEventListener("click", () => activateView(tab.dataset.publicationViewTab));
    });

    if (!synchronizeFromLocation({ restoreAnchor: true })) {
      throw new Error("The requested publication view could not be prepared.");
    }
    fallbackNavigation.hidden = true;
    scopeTablist.hidden = false;
    viewTablist.hidden = false;
    publications.dataset.enhanced = "true";
  } catch (error) {
    restoreFallback();
    console.error("The publication controls could not be initialized.", error);
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
    clearPublicationParameters();
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
      if (isTopicTarget(target)) {
        // Reveal the group before native fragment scrolling, including repeat
        // clicks on a fragment that is already in the address bar.
        if (applyState("full", "topic")) {
          const group = topicGroupFor(target);
          if (group) {
            openTopicGroup(group);
            if (event.detail === 0) {
              window.requestAnimationFrame(() => {
                if (group.isConnected) group.querySelector("summary")?.focus({ preventScroll: true });
              });
            }
          }
        }
        return;
      }
      if (
        !target ||
        !fullPanel.contains(target) ||
        (target !== fullPanel && !target.matches(publicationAnchorSelector))
      ) {
        return;
      }

      // Give the browser a laid-out target before its native fragment action.
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
    if (sectionLink && sectionLink.dataset.sectionLink !== "publications") {
      applyState("selected", "date");
    }
  });

  // Reading past the catalogue must not collapse it. The navigation's current
  // section changes during ordinary scrolling; hiding Full at that point would
  // remove thousands of pixels above the viewport and move the reader abruptly.
})();
