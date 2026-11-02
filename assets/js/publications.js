(() => {
  "use strict";

  // The shared controller is loaded first; retain the source lists if it fails.
  window.gabbayInitializeCatalogue?.({
    kind: "publication",
    collection: "publications",
    queryKey: "pubs",
    topicMarker: "data-publication-topic-trial",
    anchorSelector: ".publication[id], .publication__related-version[id], [data-publication-alias]",
    emptyText: "The complete bibliography is being prepared.",
  });
})();
