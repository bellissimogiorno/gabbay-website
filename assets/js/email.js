(() => {
  "use strict";

  const dialog = document.querySelector("[data-email-dialog]");
  if (!dialog) return;

  const surface = dialog.querySelector("[data-email-surface]");
  const closeButton = dialog.querySelector("[data-email-close]");
  if (!surface || !closeButton) return;

  let activeTrigger = null;

  const isOpen = () => dialog.hasAttribute("open");

  const focusableElements = () =>
    Array.from(
      dialog.querySelectorAll(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !element.hidden && element.getClientRects().length > 0);

  const openDialog = (trigger) => {
    if (typeof dialog.showModal !== "function") return false;

    activeTrigger = trigger;
    try {
      dialog.showModal();
    } catch (_error) {
      activeTrigger = null;
      return false;
    }

    document.documentElement.classList.add("has-dialog-open");
    closeButton.focus();
    return true;
  };

  const closeDialog = () => {
    if (!isOpen()) return;
    dialog.close();
  };

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest?.("[data-email-details-trigger]");
    if (!trigger) return;
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    if (openDialog(trigger)) event.preventDefault();
  });

  closeButton.addEventListener("click", closeDialog);

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog();
  });

  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDialog();
  });

  dialog.addEventListener("close", () => {
    document.documentElement.classList.remove("has-dialog-open");
    const trigger = activeTrigger;
    activeTrigger = null;
    if (trigger?.isConnected) trigger.focus();
  });

  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeDialog();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = focusableElements();
    if (!focusable.length) {
      event.preventDefault();
      surface.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const focusIsInside = dialog.contains(document.activeElement);
    if (event.shiftKey && (!focusIsInside || document.activeElement === first)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (!focusIsInside || document.activeElement === last)) {
      event.preventDefault();
      first.focus();
    }
  });
})();
