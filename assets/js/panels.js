(() => {
  "use strict";

  const panelSelector = "[data-clickable-panel]";
  const primarySelector = "[data-panel-primary]";
  const interactiveSelector = [
    "a",
    "button",
    "input",
    "select",
    "textarea",
    "label",
    "summary",
    "details",
    "iframe",
    "audio[controls]",
    "video[controls]",
    '[contenteditable]:not([contenteditable="false"])',
    '[tabindex]:not([tabindex="-1"])',
    '[role="button"]',
    '[role="link"]',
    '[role="checkbox"]',
    '[role="switch"]',
    "[data-panel-click-ignore]",
  ].join(", ");
  const movementLimit = 6;
  const multiClickDelay = 350;

  let press = null;
  let pendingActivation = null;

  if (!("PointerEvent" in window)) return;
  document.documentElement.classList.add("has-clickable-panels");

  const eventElement = (event) =>
    event.target instanceof Element ? event.target : null;

  const isInteractive = (target, panel) => {
    const interactive = target?.closest(interactiveSelector);
    return Boolean(interactive && panel?.contains(interactive));
  };

  const cancelPendingActivation = () => {
    if (!pendingActivation) return;
    clearTimeout(pendingActivation);
    pendingActivation = null;
  };

  const pointIsInRect = (x, y, rect) =>
    rect.width > 0 &&
    rect.height > 0 &&
    x >= rect.left &&
    x <= rect.right &&
    y >= rect.top &&
    y <= rect.bottom;

  const textNodeIsSelectable = (node, panel) => {
    for (let element = node.parentElement; element; element = element.parentElement) {
      const style = getComputedStyle(element);
      if (style.userSelect === "none" || style.webkitUserSelect === "none") return false;
      if (element === panel) break;
    }

    return true;
  };

  const textNodeContainsPoint = (node, panel, x, y) => {
    if (!node.data || !panel.contains(node) || !textNodeIsSelectable(node, panel)) {
      return false;
    }

    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = range.getClientRects();

    for (let index = 0; index < rects.length; index += 1) {
      if (pointIsInRect(x, y, rects[index])) return true;
    }

    return false;
  };

  // Text clicks wait briefly for a possible multi-click selection gesture;
  // true blank-space clicks can still follow the primary link immediately.
  const pointIsOnSelectableText = (panel, x, y) => {
    let caretNode = null;

    if (typeof document.caretPositionFromPoint === "function") {
      caretNode = document.caretPositionFromPoint(x, y)?.offsetNode ?? null;
    } else if (typeof document.caretRangeFromPoint === "function") {
      caretNode = document.caretRangeFromPoint(x, y)?.startContainer ?? null;
    }

    if (
      caretNode?.nodeType === Node.TEXT_NODE &&
      textNodeContainsPoint(caretNode, panel, x, y)
    ) {
      return true;
    }

    // The caret APIs may return a neighbouring element at inline boundaries.
    const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT);
    let textNode = walker.nextNode();

    while (textNode) {
      if (textNode !== caretNode && textNodeContainsPoint(textNode, panel, x, y)) {
        return true;
      }
      textNode = walker.nextNode();
    }

    return false;
  };

  const selectionTouches = (panel) => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return false;

    for (let index = 0; index < selection.rangeCount; index += 1) {
      try {
        if (selection.getRangeAt(index).intersectsNode(panel)) return true;
      } catch (_error) {
        // A range in a detached tree cannot intersect this live panel.
      }
    }

    return false;
  };

  const updateMovement = (event) => {
    if (!press || press.pointerId !== event.pointerId) return;

    const distance = Math.hypot(
      event.clientX - press.x,
      event.clientY - press.y,
    );
    press.maxDistance = Math.max(press.maxDistance, distance);
  };

  const followPrimary = (panel) => {
    const primary = panel.querySelector(primarySelector);
    if (primary instanceof HTMLAnchorElement) primary.click();
  };

  document.addEventListener("pointerdown", (event) => {
    cancelPendingActivation();

    const target = eventElement(event);
    const panel = target?.closest(panelSelector);
    const interactive = isInteractive(target, panel);
    const startedOnText =
      event.pointerType === "mouse" &&
      panel &&
      !interactive &&
      pointIsOnSelectableText(panel, event.clientX, event.clientY);

    press =
      event.button === 0 &&
      event.isPrimary &&
      (event.pointerType !== "mouse" || event.detail <= 1) &&
      panel &&
      !interactive &&
      !selectionTouches(panel)
        ? {
            panel,
            pointerId: event.pointerId,
            pointerType: event.pointerType,
            x: event.clientX,
            y: event.clientY,
            maxDistance: 0,
            released: false,
            onText: startedOnText,
          }
        : null;
  }, true);

  document.addEventListener("pointermove", updateMovement, true);

  document.addEventListener("pointerup", (event) => {
    if (!press || press.pointerId !== event.pointerId) return;

    updateMovement(event);

    const target = eventElement(event);
    const panel = target?.closest(panelSelector);
    const interactive = isInteractive(target, press.panel);
    const releasedOnText =
      press.pointerType === "mouse" &&
      !interactive &&
      pointIsOnSelectableText(press.panel, event.clientX, event.clientY);
    press.onText ||= releasedOnText;

    if (
      event.button !== 0 ||
      panel !== press.panel ||
      interactive ||
      press.maxDistance > movementLimit
    ) {
      press = null;
      return;
    }

    press.released = true;
  }, true);

  document.addEventListener("pointercancel", (event) => {
    if (press?.pointerId === event.pointerId) press = null;
  }, true);

  document.addEventListener("click", (event) => {
    cancelPendingActivation();

    const target = eventElement(event);
    const panel = target?.closest(panelSelector);
    const origin = press;
    press = null;

    if (
      !target ||
      !panel ||
      !origin ||
      origin.panel !== panel ||
      !origin.released ||
      origin.maxDistance > movementLimit ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.detail > 1 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      isInteractive(target, panel)
    ) {
      return;
    }

    if (selectionTouches(panel)) return;

    if (origin.onText) {
      pendingActivation = setTimeout(() => {
        pendingActivation = null;
        if (!panel.isConnected || selectionTouches(panel)) return;
        followPrimary(panel);
      }, multiClickDelay);
      return;
    }

    followPrimary(panel);
  });

  document.addEventListener("dblclick", cancelPendingActivation, true);
  document.addEventListener("keydown", cancelPendingActivation, true);
  document.addEventListener("scroll", cancelPendingActivation, { capture: true, passive: true });
  document.addEventListener("wheel", cancelPendingActivation, { capture: true, passive: true });
})();
