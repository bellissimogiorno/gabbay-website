(() => {
  "use strict";

  const validModes = new Set(["normal", "compact"]);
  const catalogues = [
    { selector: "[data-publications]", storageKey: "gabbay:publications-density" },
    { selector: "[data-talks]", storageKey: "gabbay:talks-density" },
  ];

  catalogues.forEach(({ selector, storageKey }) => {
    const catalogue = document.querySelector(selector);
    const controls = catalogue?.querySelector("[data-catalogue-density-controls]");
    if (!catalogue || !controls || controls.dataset.enhanced === "true") return;
    const choices = Array.from(controls.querySelectorAll('input[type="radio"][data-catalogue-density-choice]'));
    if (choices.length !== 2 || new Set(choices.map((choice) => choice.value)).size !== 2 ||
        choices.some((choice) => !validModes.has(choice.value))) return;

    const applyMode = (mode, { remember = false } = {}) => {
      if (!validModes.has(mode)) return;
      const changed = catalogue.dataset.catalogueDensity !== mode;
      const update = () => {
        catalogue.dataset.catalogueDensity = mode;
        choices.forEach((choice) => { choice.checked = choice.value === mode; });
      };
      if (typeof window.gabbayCatalogueMotion === "function") {
        window.gabbayCatalogueMotion(catalogue, update, { animate: remember && changed });
      } else update();
      if (remember) {
        try { window.localStorage?.setItem(storageKey, mode); }
        catch (_error) { /* The view still works when browser storage is denied. */ }
      }
    };

    let saved = "compact";
    try {
      const stored = window.localStorage?.getItem(storageKey);
      if (validModes.has(stored)) saved = stored;
    } catch (_error) { /* Compact remains the default when storage is unavailable. */ }

    choices.forEach((choice) => {
      choice.addEventListener("change", () => {
        if (choice.checked) applyMode(choice.value, { remember: true });
      });
    });
    applyMode(saved);
    controls.dataset.enhanced = "true";
    controls.hidden = false;
  });
})();
