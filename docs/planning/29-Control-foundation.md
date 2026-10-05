# Shared control foundation

5 October 2026 · corrective cycle A

The neutral UI library owns `styles/tokens.scss` and `styles/controls.scss`.
The host and developer catalog load these published assets before engine styles.
Generated document typography and reader layout remain engine-owned. No new UI
framework or font dependency is required.

`--control-line` identifies editable boundaries independently from the quieter
`--line` dividers. Both themes expose surface, selection, danger, spacing, control
height and radius tokens. Native controls retain their semantics and localized
accessible names. Idle disabled controls use a normal cursor; features own their
pending labels, retry decisions and draft policy.

Use `mc-action--primary` for a commit action, the ordinary button for secondary
actions, `mc-action--quiet` for utilities, and `mc-action--danger` for an explicitly
named consequential action. `mc-icon-button` gives compact utilities a square
target. Features group these controls around their own operation.

`IconComponent` is exported from `@mastercompanion/ui`. Its required `name` input
accepts the public `IconName` union; it has no outputs or application dependency.
The SVG is decorative and hidden from assistive technology. Its owning native
button supplies the action label and title, for example:

```html
<button class="mc-icon-button mc-action--quiet"
        [attr.aria-label]="text.refresh" [title]="text.refresh"
        [disabled]="pending()" (click)="refresh()">
  <mc-icon name="refresh" />
</button>
```

Workspace, gameplay, party and session heading refresh actions consume the icon.
The theme utility announces the next action in either theme. Reader edit/finish,
document insertion and note creation use the primary treatment. Editable engine
fields use the control border; document and dialog dividers retain their quieter
appearance. The catalog shows enabled, disabled, pending, consequential, long
text and error examples, with keyboard focus and theme switching.

The scoped `@controls` browser checks exercise theme activation/focus and actual
search-boundary contrast against both adjacent surfaces. Integration compilation
and dependency guards verify the new public library/style consumers. Feedback
and dialog-shell extraction remain separate work in the improvement plan.

Verification: full frontend quality/integration build passed; all eight focused
@controls browser cases passed across light/dark and both desktop sizes.

