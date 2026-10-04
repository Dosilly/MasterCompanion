# Harkan player thread

4 October 2026

## Content scope

The player-thread folder is titled `Wątki graczy` and contains a Harkan child
folder alongside Fenes. Three authored Markdown materials provide one GM guide
and two complete in-world handouts. The module now contains 109 materials in
11 folders; its 29 map markers retain their existing targets.

The GM guide joins two personal stories without adding a required quest or a new
condition for the chapter finale. The father receives symptom suppression from
the existing chardalyn staff in Y19f after attunement. Corruption remains, and
symptoms return when protection is interrupted. The report in Y24 and caregiver
instructions in Y19f disclose that limitation and explain use outside Ythryn.
The instructions also work without finding the earlier report.

Moonbow first speaks at the initial sight of Ythryn; previous communication was
limited to sleepy visions. Conversation is telepathic and private to Harkan.
The spirit remembers the old city and the purpose of the Arcane Octad, but not
the full ritual sequence or current hazards. Its chapter goal is to revisit Y25
and determine whether the city can still be home. Leaving the entire bow there
is a voluntary epilogue decision, independent of protection for the father.

The introduction and Y1 share a single arrival trigger. Y6 links ritual guidance;
Y24 and Y19f link their handouts and GM rules; Y25 links the reunion scene and
epilogue. Existing location anchors, encounters, ritual rules and other player
threads remain intact. No engine, contract or persistence-schema changes are
required.

## Verification and local delivery

Verification covers module compilation, internal links, navigation assignments,
document-schema round trips and lossless source export. Local delivery applies
only the affected module materials and folder metadata to the development
campaign, with atomic writes, revision checks and an idempotent update. It does
not add automatic replacement at startup or local backup infrastructure.

All 16 content/source integration tests passed. After the final Y6 scene-heading
adjustment, the two affected rendering/link cases passed again. The Ythryn module
build passed with no warnings or errors; the code/localization guard and formatting
of the changed test and reference fixture passed. Package preparation reports
109 materials, 11 folders and one map.
