(() => {
  "use strict";

  const dialog = document.querySelector("[data-bibtex-dialog]");
  if (!dialog) return;

  const surface = dialog.querySelector("[data-bibtex-surface]");
  const closeButton = dialog.querySelector("[data-bibtex-close]");
  const downloadButton = dialog.querySelector("[data-bibtex-download]");
  const copyButton = dialog.querySelector("[data-bibtex-copy]");
  const code = dialog.querySelector("[data-bibtex-code]");
  const publicationTitle = dialog.querySelector("[data-bibtex-publication-title]");
  const copyStatus = dialog.querySelector("[data-bibtex-copy-status]");

  if (
    !surface ||
    !closeButton ||
    !downloadButton ||
    !copyButton ||
    !code ||
    !publicationTitle ||
    !copyStatus
  ) {
    return;
  }

  let activeTrigger = null;
  let copyStatusTimer = 0;
  let dialogSession = 0;

  const isOpen = () => dialog.hasAttribute("open");

  const focusableElements = () =>
    Array.from(
      dialog.querySelectorAll(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !element.hidden && element.getClientRects().length > 0);

  const setCopyStatus = (message, { reset = true } = {}) => {
    window.clearTimeout(copyStatusTimer);
    copyStatus.textContent = message;
    if (!reset || !message) return;
    copyStatusTimer = window.setTimeout(() => {
      copyStatus.textContent = "";
    }, 3200);
  };

  const openDialog = (trigger) => {
    if (typeof dialog.showModal !== "function") return false;

    const source = trigger.parentElement?.querySelector("[data-bibtex-source]");
    const bibtex = source?.content?.textContent?.trim();
    if (!bibtex) return false;

    activeTrigger = trigger;
    code.textContent = bibtex;
    publicationTitle.textContent = trigger.dataset.bibtexTitle || "Publication citation";
    setCopyStatus("", { reset: false });

    try {
      dialog.showModal();
    } catch (_error) {
      activeTrigger = null;
      return false;
    }

    dialogSession += 1;
    copyButton.disabled = false;
    document.documentElement.classList.add("has-dialog-open");
    copyButton.focus();
    return true;
  };

  const closeDialog = () => {
    if (!isOpen()) return;
    dialog.close();
  };

  const selectCitation = () => {
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(code);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const legacyCopy = () => {
    const textarea = document.createElement("textarea");
    textarea.value = code.textContent || "";
    textarea.setAttribute("readonly", "");
    textarea.setAttribute("aria-hidden", "true");
    textarea.className = "bibtex-dialog__clipboard-fallback";
    // A modal makes the rest of the document inert. The temporary field must
    // stay inside it so browsers can actually focus and select its contents.
    dialog.append(textarea);
    textarea.select();

    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch (_error) {
      copied = false;
    }
    textarea.remove();
    return copied;
  };

  const downloadFilename = () => {
    const citationKey = activeTrigger?.dataset.bibtexKey?.trim() || "citation";
    const safeStem = citationKey
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/^[.-]+|[.-]+$/g, "") || "citation";
    return `${safeStem}.bib`;
  };

  const downloadCitation = () => {
    const bibtex = code.textContent || "";
    if (!bibtex) return;

    const payload = `${bibtex.trimEnd()}\n`;
    const filename = downloadFilename();
    const link = document.createElement("a");
    let objectUrl = "";

    if (typeof window.Blob === "function" && window.URL?.createObjectURL) {
      const blob = new window.Blob([payload], {
        type: "application/x-bibtex;charset=utf-8",
      });
      objectUrl = window.URL.createObjectURL(blob);
      link.href = objectUrl;
    } else {
      link.href = `data:application/x-bibtex;charset=utf-8,${encodeURIComponent(payload)}`;
    }

    link.download = filename;
    link.hidden = true;
    link.setAttribute("aria-hidden", "true");
    document.body.append(link);
    link.click();
    link.remove();

    if (objectUrl) {
      window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
    }

    setCopyStatus(`Download started: ${filename}.`);
    downloadButton.focus();
  };

  const copyCitation = async () => {
    const bibtex = code.textContent || "";
    if (!bibtex) return;
    const session = dialogSession;

    copyButton.disabled = true;
    let copied = false;
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(bibtex);
        copied = true;
      } else {
        copied = legacyCopy();
      }
    } catch (_error) {
      if (isOpen() && session === dialogSession) copied = legacyCopy();
    } finally {
      if (session === dialogSession) copyButton.disabled = false;
    }

    if (!isOpen() || session !== dialogSession) return;

    if (copied) {
      setCopyStatus("Copied to clipboard.");
      copyButton.focus();
      return;
    }

    code.parentElement?.focus();
    selectCitation();
    setCopyStatus("Automatic copying was unavailable. The citation is selected for you.", {
      reset: false,
    });
  };

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest?.("[data-bibtex-trigger]");
    if (!trigger) return;
    if (isOpen()) {
      event.preventDefault();
      return;
    }
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
  downloadButton.addEventListener("click", downloadCitation);
  copyButton.addEventListener("click", copyCitation);

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog();
  });

  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDialog();
  });

  dialog.addEventListener("close", () => {
    dialogSession += 1;
    copyButton.disabled = false;
    window.clearTimeout(copyStatusTimer);
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
