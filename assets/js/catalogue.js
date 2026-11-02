/* Shared progressive enhancement for the Publications and Talks catalogues.
 * Their state machines are the same; only DOM names, query keys, anchor selectors
 * and fallback wording differ. Each call owns its DOM, sorting and history state.
 * The two small initializer scripts below this file in index.html supply those
 * differences. Without this helper the original server-rendered lists stay usable.
 */
(() => {
  "use strict";

  window.gabbayInitializeCatalogue = ({
    kind, collection, queryKey, topicMarker, anchorSelector, emptyText,
  }) => {
    const selector = (suffix) => `[data-${kind}-${suffix}]`;
    const dataName = (suffix) => `${kind}${suffix}`;
    const viewQueryKey = `${queryKey}-by`;

    const catalogue = document.querySelector(`[data-${collection}]`);
    if (!catalogue) return;

    const fallbackNavigation = catalogue.querySelector(selector("fallback"));
    const scopeTablist = catalogue.querySelector(selector("scope-tablist"));
    const scopeTabs = Array.from(catalogue.querySelectorAll(selector("scope-tab")));
    const scopePanels = Array.from(catalogue.querySelectorAll(selector("scope-panel")));
    const viewTablist = catalogue.querySelector(selector("view-tablist"));
    const viewTabs = Array.from(catalogue.querySelectorAll(selector("view-tab")));
    const viewPanels = Array.from(catalogue.querySelectorAll(selector("view-panel")));
    const fullPanel = catalogue.querySelector(`[data-${kind}-scope-panel="full"]`);
    const datePanel = viewPanels.find((panel) => panel.dataset[dataName("ViewPanel")] === "date");
    const topicPanel = viewPanels.find((panel) => panel.dataset[dataName("ViewPanel")] === "topic");
    const sharedTopics = Boolean(topicPanel?.hasAttribute(topicMarker));
    // Repeated topic cards have namespaced anchors. Counts and sortable nodes
    // always come from the canonical date listing, never from cross-listings.
    const canonicalPanel = sharedTopics ? datePanel : fullPanel;
    const catalogueItems = canonicalPanel
      ? Array.from(canonicalPanel.querySelectorAll(selector("item")))
      : [];
    const sortablePanels = sharedTopics
      ? viewPanels.filter((panel) => panel !== topicPanel)
      : viewPanels;
    const originalOrder = new Map(
      catalogueItems.map((item, index) => [item, index]),
    );
    const itemCount = catalogue.querySelector(selector("count"));

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
      ? target.closest(`details${selector("topic")}`)
      : null;

    const topicGroups = sharedTopics
      ? Array.from(topicPanel.querySelectorAll(`details${selector("topic")}`))
      : [];
    const topicMotionPending = new WeakSet();

    const closeOtherTopics = (group) => {
      topicGroups.forEach((other) => {
        if (other !== group && other.open) other.open = false;
      });
    };

    const openTopicGroup = (group) => {
      if (catalogue.dataset.enhanced === "true" && !group.open) topicMotionPending.add(group);
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
            window.gabbayCatalogueMotion?.reveal?.(group.querySelector(`.${kind}-list`));
          }
        }
        topicMotionPending.delete(group);
      });
    });

    // Resolve location state without disturbing unrelated query parameters.
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
      let scope = parameters.get(queryKey) === "full" ? "full" : "selected";
      let view = parameters.get(viewQueryKey) || "date";
      const hash = decodedHash();
      const hashTarget = hash ? document.getElementById(hash) : null;
      const targetsTopic = isTopicTarget(hashTarget);
      const targetsCatalogue =
        !hash ||
        hash === collection ||
        hash === `selected-${collection}` ||
        hash === `full-${collection}` ||
        Boolean(hashTarget && fullPanel.contains(hashTarget));

      if (!targetsCatalogue) {
        return {
          scope: "selected",
          view: "date",
          targetsCatalogue: false,
          entryAnchor: null,
        };
      }

      if (targetsTopic) {
        scope = "full";
        view = "topic";
      } else if (hash === `full-${collection}` || (hashTarget && fullPanel.contains(hashTarget))) {
        scope = "full";
        view = "date";
      } else if (hash === `selected-${collection}`) {
        scope = "selected";
      }

      if (!validViews.has(view) || scope !== "full") view = "date";
      return {
        scope,
        view,
        targetsCatalogue: true,
        topicGroup: topicGroupFor(hashTarget),
        entryAnchor:
          hashTarget &&
          (targetsTopic || scopePanels.includes(hashTarget) ||
            (fullPanel.contains(hashTarget) &&
              hashTarget.matches(anchorSelector)))
            ? hashTarget
            : null,
      };
    };

    // Accessible tab semantics and keyboard activation are shared by both levels.
    const tabValue = (tab, name) => tab.dataset[name];

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

    // Build alternate views from the canonical nodes, retaining stable ties.
    // Ignore opening punctuation and an initial article for alphabetical order.
    // The displayed titles are unchanged.
    const titleKey = (item) =>
      itemValue(item, dataName("Title"))
        .replace(/^[^\p{L}\p{N}]+/u, "")
        .replace(/^(a|an|the)\s+/i, "")
        .replace(/^[^\p{L}\p{N}]+/u, "")
        .trim();

    const itemTimestamp = (item) => {
      const rawDate = itemValue(item, dataName("Date"));
      const rawYear = itemValue(item, dataName("Year"));
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
      const difference = itemTimestamp(right) - itemTimestamp(left);
      return difference || originalOrder.get(left) - originalOrder.get(right);
    };

    const groupValue = (item, view) => {
      if (view === "date") {
        return itemValue(item, dataName("Year")) || "Forthcoming and undated";
      }
      if (view === "topic") return itemValue(item, dataName("Topic")) || "Other";
      if (view === "type") return itemValue(item, dataName("Type")) || "Other";

      const firstCharacter = titleKey(item).match(/[A-Z]/i)?.[0];
      return firstCharacter ? firstCharacter.toUpperCase() : "0–9";
    };

    const sortedItems = (view) => {
      const items = [...catalogueItems];
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
      groupsContainer.className = `${kind}-groups`;
      groupsContainer.dataset[dataName("Groups")] = "";

      let groupIndex = 0;
      groups.forEach((items, label) => {
        const group = document.createElement("section");
        const heading = document.createElement("h4");
        const list = document.createElement("ol");
        const headingId = `${kind}-${view}-group-${slug(label)}-${groupIndex}`;
        groupIndex += 1;

        group.className = `${kind}-group`;
        group.setAttribute("aria-labelledby", headingId);
        heading.className = `${kind}-group__title`;
        heading.id = headingId;
        heading.textContent = label;
        list.className = `${kind}-list`;
        items.forEach((item) => list.append(item));

        group.append(heading, list);
        groupsContainer.append(group);
      });

      return groupsContainer;
    };

    const renderView = (view) => {
      const target = viewPanels.find((panel) => panel.dataset[dataName("ViewPanel")] === view);
      if (!target) return false;
      // The shared-topic listing is rendered on the server and has its own
      // namespaced cards. Keep its native details and open states intact.
      if (sharedTopics && view === "topic") return true;
      if (renderedView === view && target.querySelectorAll(selector("item")).length === catalogueItems.length) {
        return true;
      }

      const priorPanelContents = new Map(
        sortablePanels.map((panel) => [panel, Array.from(panel.childNodes)]),
      );
      const priorItemPositions = catalogueItems.map((item) => ({
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
        if (catalogueItems.length) {
          nextContent = buildGroups(view);
        } else {
          const emptyMessage = document.createElement("p");
          emptyMessage.className = `${kind}-empty`;
          emptyMessage.textContent = emptyText;
          nextContent = emptyMessage;
        }

        sortablePanels.forEach((panel) => panel.replaceChildren());
        target.append(nextContent);
        renderedView = view;
        return true;
      } catch (error) {
        restorePriorView();
        console.error(`The ${collection} could not be arranged by ${view}.`, error);
        return false;
      }
    };

    const updateCount = () => {
      if (!itemCount) return;
      const noun = catalogueItems.length === 1 ? "item" : "items";
      itemCount.textContent = `${catalogueItems.length} ${noun}, arranged by ${state.view}.`;
    };

    // Apply DOM changes transactionally before committing URL/history state.
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
          tabDataName: dataName("ScopeTab"),
          panelDataName: dataName("ScopePanel"),
          value: state.scope,
        });
        updateTabset({
          tabs: viewTabs,
          panels: viewPanels,
          tabDataName: dataName("ViewTab"),
          panelDataName: dataName("ViewPanel"),
          value: state.view,
        });
        updateCount();
        return true;
      };
      return typeof window.gabbayCatalogueMotion === "function"
        ? window.gabbayCatalogueMotion(catalogue, update, {
          animate: catalogue.dataset.enhanced === "true" && changed,
        })
        : update();
    };

    const writeLocation = () => {
      const url = new URL(window.location.href);
      if (state.scope === "full") {
        url.searchParams.set(queryKey, "full");
        if (state.view === "date") url.searchParams.delete(viewQueryKey);
        else url.searchParams.set(viewQueryKey, state.view);
      } else {
        url.searchParams.delete(queryKey);
        url.searchParams.delete(viewQueryKey);
      }
      url.hash = collection;

      const nextLocation = `${url.pathname}${url.search}${url.hash}`;
      const currentLocation = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (nextLocation === currentLocation) return;

      const priorState =
        window.history.state && typeof window.history.state === "object"
          ? window.history.state
          : {};
      window.history.pushState(
        { ...priorState, [collection]: { scope: state.scope, view: state.view } },
        "",
        nextLocation,
      );
    };

    const activateScope = (scope) => {
      if (scope === state.scope) return;
      if (!applyState(scope, "date")) return;
      writeLocation();
    };

    const activateView = (view) => {
      if (state.scope === "full" && view === state.view) return;
      if (!applyState("full", view)) return;
      writeLocation();
    };

    const clearCatalogueParameters = () => {
      const url = new URL(window.location.href);
      const hadParameters = url.searchParams.has(queryKey) || url.searchParams.has(viewQueryKey);
      url.searchParams.delete(queryKey);
      url.searchParams.delete(viewQueryKey);
      if (!hadParameters) return;

      const priorState =
        window.history.state && typeof window.history.state === "object"
          ? window.history.state
          : {};
      window.history.replaceState(
        { ...priorState, [collection]: { scope: "selected", view: "date" } },
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    };

    const synchronizeFromLocation = ({ restoreAnchor = false } = {}) => {
      const nextState = stateFromLocation();
      const applied = applyState(nextState.scope, nextState.view);
      if (!nextState.targetsCatalogue) clearCatalogueParameters();
      if (applied && nextState.topicGroup) openTopicGroup(nextState.topicGroup);
      if (applied && restoreAnchor && nextState.entryAnchor) {
        window.requestAnimationFrame(() => {
          const target = nextState.entryAnchor === nextState.topicGroup
            ? nextState.topicGroup.querySelector("summary") || nextState.topicGroup
            : nextState.entryAnchor;
          target.scrollIntoView({ behavior: "auto", block: "start" });
        });
      }
      return applied;
    };

    // Failed enhancement restores ordinary readable server-rendered lists.
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
        panel.hidden = panel.dataset[dataName("ViewPanel")] !== "date" &&
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
        tabDataName: dataName("ScopeTab"),
        panelDataName: dataName("ScopePanel"),
      });
      configureTabset({
        tablist: viewTablist,
        tabs: viewTabs,
        panels: viewPanels,
        tabDataName: dataName("ViewTab"),
        panelDataName: dataName("ViewPanel"),
      });

      scopeTabs.forEach((tab) => {
        tab.addEventListener("click", () => activateScope(tab.dataset[dataName("ScopeTab")]));
      });
      viewTabs.forEach((tab) => {
        tab.addEventListener("click", () => activateView(tab.dataset[dataName("ViewTab")]));
      });

      if (!synchronizeFromLocation({ restoreAnchor: true })) {
        throw new Error(`The requested ${kind} view could not be prepared.`);
      }
      fallbackNavigation.hidden = true;
      scopeTablist.hidden = false;
      viewTablist.hidden = false;
      catalogue.dataset.enhanced = "true";
    } catch (error) {
      restoreFallback();
      console.error(`The ${kind} controls could not be initialized.`, error);
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
      clearCatalogueParameters();
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
          (target !== fullPanel && !target.matches(anchorSelector))
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
      if (sectionLink && sectionLink.dataset.sectionLink !== collection) {
        applyState("selected", "date");
      }
    });

    // Keep the chosen view while the reader scrolls into another section. Only an
    // explicit navigation action should collapse the long catalogue.
  };
})();
