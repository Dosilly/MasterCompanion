# Fenes portable device appearance

4 October 2026

The portable Two Shores device in Y19q now uses a wooden carrying case with a
folding copper speaking horn, a palm contact plate, a glass-covered measuring
dial with a silver needle, and four removable trace plates. All components remain
mounted in the base. A hinge lets the horn lie sideways in a padded recess before
closing the lid. The case retains its one-foot width and five-pound total weight.

The device replaces the former three-ring assembly. The player instructions,
GM guide and Y19q contents/read-aloud description share the same component layout,
preparation and voice path. The dial resembles a compass but does not indicate
the travel direction or the contact's position. Communication limits, trace
storage, measurement cooperation and independence from city power are unchanged.
The older stationary receiver in Y15 retains its existing stone lectern, copper
horn and palm plate. No engine, contract, schema or frontend behavior changes
are required.

Five intentionally edited sections in the maintained content-reference fixture
receive new hashes after comparison with their previous committed versions.
Other reference sections, material IDs, heading anchors and navigation remain
unchanged. Local campaign delivery is scoped to the three edited documents and
uses atomic, revision-checked, idempotent writes under the development data policy.

Module compilation passed with the existing 109 materials, 11 folders and one map.
Four scoped content cases passed: schema round trips, internal links, consolidated
section references and lossless Markdown export. The code/localization guard and
formatting of the changed reference fixture also passed.

Local delivery completed from merged `trunk` (`4509514`) using image
`mastercompanion:fenes-case-4509514`. The application container is healthy;
the health endpoint and player-material route return HTTP 200. API readback
matches all three compiled documents. Replaying the atomic update leaves
their revisions unchanged.
