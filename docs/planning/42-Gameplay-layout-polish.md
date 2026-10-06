# Gameplay layout and concise guidance

6 October 2026 · follow-up to [gameplay hierarchy](36-Gameplay-hierarchy.md)

The clock activity buttons now have a separate, compact input/apply row and a
24-pixel gap before module attention notices. The sticky command surface covers
the entire scroll viewport, with its title/actions aligned to the clock content
and a subtle bottom border. Scroll padding keeps focused task targets below it.

Module rule disclosures share spacing and focus treatment. Rule-document links
sit inside those disclosures rather than touching unrelated action buttons.
Auril's disable action has its own block and a clear gap before the rules.

Repeated instructions were removed or shortened in both locale catalogs. Activity
duration remains in selection labels; clock/exploration scope stays beside apply.
Encounter scheduling, arrival timing and disease schedules are available under
Rules. Arrival replacement timing, cultist conversion, earlier-loss ordering and
third-failure transformation remain visible at their affected actions. Arrival
buttons use concise visible copy and retain their named target for assistive
technology. This is presentation only; operation ownership and persistence are
unchanged.

Verification: 24 gameplay hierarchy cases pass, including measured control gaps
and full-width sticky coverage after scrolling. Eight affected visual cases pass
in light/dark at 1920×1080 and 1536×864, followed by a successful comparison with
snapshot updates disabled. The intentional clock, arrival, encounter, disease
and force-counter visuals and both Full HD scrolled surfaces were reviewed.
The UI test server compiled separately built libraries and their Angular host.

Delivery follows the 6 October workflow in the primary checkout's AGENTS.md:
commit the verified feature branch, update the local image from that branch,
and leave merging into trunk to the user. Unrelated planning edits in the primary
checkout remain separate.

Local delivery: image `mastercompanion:ui-polish-6892924` is built from the
verified feature source commit `6892924` and is running on loopback port 4200.
Frontend quality, production compilation and four read-only container probes
pass. Live Full HD light/dark checks verify the compact clock, disclosed rule
links and sticky viewport coverage with no campaign writes or browser errors.
The live light page and dark scrolled page were visually reviewed. Both app and
PostgreSQL are healthy. The feature remains on `codex/ux-gameplay-polish` for the
user's merge; no remote push was performed.
