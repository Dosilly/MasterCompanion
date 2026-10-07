# Context menu component catalog

4 October 2026 · first shared UI interaction primitive

The separately compiled `@mastercompanion/ui` library owns the context menu's
presentation, viewport positioning, keyboard interaction, dismissal and focus
lifecycle. Folder, material and workspace-tab consumers supply their own actions
through the engine's `WorkspaceContextMenuComponent`. Campaign state, permission
to rename or move, persistence, save-before-close and clipboard feedback remain
engine responsibilities.

## Public API

Import `ContextMenuComponent`, `ContextMenuPresentation` and `ContextMenuAction`
from `@mastercompanion/ui`. The component uses the `mc-context-menu` selector.

| Input/output | Type | Meaning |
| --- | --- | --- |
| `presentation` | `ContextMenuPresentation` | Required immutable presentation of one open menu |
| `actionSelected` | `string` output | Enabled action ID selected by pointer, Enter or Space |
| `dismissed` | `void` output | Outside pointer, Escape, Tab, outside scrolling or viewport resize |

`ContextMenuPresentation` contains a viewport `anchor: { x, y }`, the original
`trigger: HTMLElement`, a localized accessible `label`, and readonly `actions`.
Each action has an `id`, localized `label`, optional `disabled` flag, optional
`icon: IconName` and optional `destructive: boolean`. The icon is decorative; the
label supplies meaning. Destructive actions use the theme danger token while
retaining normal keyboard behavior and disabled/focus treatment. The catalog
includes enabled and disabled Delete actions with the shared trash icon. Action
IDs must be unique within one menu. The caller conditionally mounts the component
while open and unmounts it on either output. Closing a feature or changing its
target also unmounts or replaces the presentation.

The library receives localized strings; it imports no campaign contracts,
engine, module, HTTP client or persistence code. The engine adapter emits its
typed folder, material and tab action union. Domain decisions remain with the
workspace feature.

## Actual usage

The workspace mounts its feature adapter with a single current presentation:

```html
<mc-workspace-context-menu
  [presentation]="menus.presentation()"
  (actionSelected)="contextAction($event)"
  (dismissed)="menus.presentation.set(null)"
/>
```

Its state owner builds actions for right-click and ContextMenu/Shift+F10 gestures
on folders, materials and tabs. Folder actions create a note in that folder,
rename, move and expand/collapse. Material actions open, reveal in the tree and
copy the material URL. Tab actions close, close others, reveal and copy a URL when
applicable. The workspace chooses each operation and preserves its existing
save-before-close behavior.

The standalone developer catalog directly consumes the same public UI API:

```html
@if (menu(); as presentation) {
  <mc-context-menu
    [presentation]="presentation"
    (actionSelected)="select($event)"
    (dismissed)="menu.set(null)"
  />
}
```

## Developer surface

Run `pnpm --dir src/mastercompanion-web catalog`. It rebuilds the UI library
before serving the separate `ui-catalog` application on loopback port 4311.
The catalog is excluded from the production host build and uses no API.

The catalog provides light/dark switching, enabled/disabled actions, long labels,
keyboard focus and a second independently focusable trigger with all actions
disabled. A menu with all actions disabled focuses its menu container so Escape
still works. Empty, loading and error content are feature states: consumers
supply applicable actions and their enabled status after loading; the primitive
does not fetch data or render unrelated recovery messages.

The menu fits inside the viewport with an eight-pixel margin and scrolls when
needed. Arrow Up/Down wrap over enabled actions, Home/End select boundaries,
Enter/Space invoke the focused action, and Escape returns focus to the original
trigger. Outside pointer dismissal leaves pointer focus to its selected target.
Removing or replacing the menu removes all owned listeners; detached triggers
are never focused.

## Verification

- Twelve focused real-DOM tests cover keyboard navigation, disabled actions,
  activation, dismissal, listener cleanup, focus return and viewport clamping.
- The UI server/cache suite covers source changes in `projects/ui` as a cache
  invalidation input. Build/start/test-server paths rebuild UI before consumers.
- The library and separate catalog compiled successfully. Catalog rendering was
  reviewed at 1920×1080 in both themes with focused and disabled actions and no
  browser page errors. Screenshots are local review artifacts, not baselines.
- Workspace browser tests cover the actual folder, material and tab actions in
  the owning feature's delivery verification.

Other UI extractions in [the reusable UI plan](17-Reusable-frontend-ui.md),
including dialogs, feedback, tabs and theme ownership, remain separate slices.
