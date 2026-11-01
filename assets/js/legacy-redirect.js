/* Compatibility for the exact old catalogue pages on static hosts.
 * The layout generates aliases from the catalogue data; no second item list
 * needs maintaining. Keep source-page maps separate: "fmhotn" is ambiguous.
 */
(() => {
  "use strict";

  const dataElement = document.getElementById("legacy-link-data");
  const catalogueLink = document.getElementById("legacy-catalogue-link");
  const status = document.getElementById("legacy-link-status");
  if (!dataElement || !catalogueLink || !status) return;

  const decodeFragment = (value) => {
    try { return decodeURIComponent(value); }
    catch (_error) { return null; }
  };

  try {
    const data = JSON.parse(dataElement.textContent);
    const isPapers = data.catalogue === "papers";
    if (!isPapers && data.catalogue !== "talks") return;
    const section = isPapers ? "publications" : "talks";
    if (data.section !== section || !Array.isArray(data.records)) return;

    // The destination comes only from a generated same-site link. Incoming
    // query parameters are intentionally not copied (including redirect URLs).
    const destination = new URL(catalogueLink.getAttribute("href"), window.location.href);
    if (destination.origin !== window.location.origin) return;
    if (!["http:", "https:", "file:"].includes(destination.protocol)) return;
    destination.search = isPapers ? "?pubs=full" : "?talks=full";

    const aliases = new Map();
    const register = (alias, target) => {
      if (typeof alias !== "string" || !alias || typeof target !== "string" || !target) return;
      if (aliases.has(alias) && aliases.get(alias) !== target) {
        throw new Error("Ambiguous legacy catalogue alias");
      }
      aliases.set(alias, target);
    };
    // Also tolerate links to current catalogue controls at the old pathname.
    register(section, section);
    register(`full-${section}`, section);
    register(`selected-${section}`, section);
    for (const [id, names, source] of data.records) {
      if (!id) continue; // The final empty tuple keeps Liquid output valid JSON.
      register(id, id);
      if (Array.isArray(names)) names.forEach((alias) => register(alias, id));
      if (typeof source !== "string" || !source) continue;
      const old = new URL(source, "https://www.gabbay.org.uk/");
      if (!["gabbay.org.uk", "www.gabbay.org.uk"].includes(old.hostname)) continue;
      if (old.pathname !== `/${data.catalogue}.html`) continue;
      register(decodeFragment(old.hash.slice(1)), id);
    }

    const raw = window.location.hash.slice(1);
    const requested = decodeFragment(raw);
    if (raw && (requested === null || !aliases.has(requested))) {
      // Do not pretend an unrecognised link reached its target. Leave its
      // original fragment in the address bar and give the visitor two routes.
      status.textContent = "This old section link is not in the current catalogue. Browse the full list, or open the new catalogue with the same fragment in its address.";
      const originalLink = document.getElementById("legacy-original-link");
      const wrapper = document.getElementById("legacy-original-link-wrapper");
      if (originalLink && wrapper) {
        destination.hash = window.location.hash;
        originalLink.href = destination.href;
        wrapper.hidden = false;
      }
      return;
    }

    destination.hash = encodeURIComponent(raw ? aliases.get(requested) : section);
    status.textContent = "Opening the catalogue…";
    window.location.replace(destination.href);
  } catch (_error) {
    // A damaged map, blocked navigation or unsupported API must leave a useful
    // ordinary link, rather than a blank page or an automatic redirect loop.
    status.textContent = "Please use the link below to open the full catalogue.";
  }
})();
