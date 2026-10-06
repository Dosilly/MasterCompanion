# Explicit draft recovery

6 October 2026 · slice C

## Interaction and ownership

Compared an inline saved-document panel with an on-demand modal preview. The
modal keeps the long reader's width and reading position while allowing an
independently scrolling saved version. Session fields use an inline comparison
beside their explicit-save form because all three values are short plain text.

```text
Material: conflict commands -> Inspect -> saved revision/document
                                      -> return / adopt / reapply
Session: retained fields -> Inspect -> saved title/summary/follow-up
                                   -> adopt / reapply
```

The material session owns the retained document and the inspected snapshot.
Inspection validates the existing single-material GET response and never
publishes it into the campaign cache or editor. Explicit adoption publishes the
inspected content without a write and remounts the editor to clear old undo
history. Reapplication writes the complete retained document using exactly the
inspected revision. A newer remote write still produces a conflict and requires
another inspection. Request cancellation and timers belong to session lifetime.

Session drafts retain independent original records. Inspection refreshes the
collection without rebasing those originals. Explicit reapplication captures the
inspected collection revision in the existing idempotent operation receipt.
Uncertain operations keep their exact retry identity. Failed reads and deleted
records cannot enable adoption or reapplication. No backend or schema change is
needed; rich-document merging and persistent browser draft storage remain outside
this slice.

Copy actions report success or failure without replacing the save-conflict
message. Material copy failure exposes the complete plain-text draft in a
selectable read-only field. Session drafts include title, summary and follow-up;
deleted records retain individually selectable fields and a copy action.

## Verification

- 52 focused unit/integration cases pass: recovery, autosave, actual editor,
  session fields and session receipt recovery. New cases exercise validated reads,
  adoption, repeated conflicts, exact inspected revisions, failed reads, cancelled
  inspection and independent drafts.
- 20 scoped browser cases pass across both themes and desktop sizes, including
  keyboard dismissal/focus return, adoption without writes, deliberate reapplication,
  repeated conflict, failed clipboard/read and session recovery. A selector was
  corrected to distinguish the editor from the new manual-copy textbox; only its
  four failed cases were rerun.
- Frontend quality checks pass; the isolated browser build compiled all libraries
  and the production host. Full HD preview screenshots in both themes were
  reviewed. Tests use isolated fixtures, never the local campaign.

Local merge and runtime delivery are recorded in implementation status after
readiness verification.
