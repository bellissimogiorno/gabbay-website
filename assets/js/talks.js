(() => {
  "use strict";

  // The shared controller is loaded first; retain the source lists if it fails.
  window.gabbayInitializeCatalogue?.({
    kind: "talk",
    collection: "talks",
    queryKey: "talks",
    topicMarker: "data-talk-topic-groups",
    anchorSelector: ".talk-entry[id], [data-talk-alias]",
    emptyText: "The complete talks list is being prepared.",
  });
})();
