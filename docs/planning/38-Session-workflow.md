# Session workflow and active context

6 October 2026 · slice E delivered locally

The engine owns `/sessions` and `/sessions/:sessionId` selection, including history,
reload and missing-record recovery. Record drafts remain independently owned by
SessionDrafts. A URL restores persisted selection; it does not persist unsaved drafts
across a page reload. Preparation/play documents return to their specific record.

An always-open creation form competes with the current record; a separate wizard
would add navigation. The selected arrangement keeps the first-use form and uses
an explicit New session action thereafter. Planned, active and completed records
show stage guidance and emphasize preparation or play notes appropriately. Explicit
summary/follow-up save actions stay adjacent to the fields. Existing searchable
campaign choices retain folder context and stable material IDs.

Meeting context loads independently of opening the session panel. The header shows
the active record and one action to its play notes even on direct material visits.
Completing a meeting removes that context without requiring a summary or changing
game time. The document context returns to its own record.

Thirty-three scoped routing/draft unit cases and sixty browser cases pass across
both themes/sizes, including independent drafts, explicit saves, deletion, recovery,
record history/reload and missing IDs. One initial test setup race was corrected and
the failed case passed. The twelve workflow cases passed again after the specific
document-return correction. Frontend quality and production compilation pass.
Full HD active-record layouts were reviewed in both themes.

The later [session workspace redesign](44-Session-workspace-redesign.md) changes
composition while preserving the functional workflow and verification recorded here.
