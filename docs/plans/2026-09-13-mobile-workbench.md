# Mobile workbench plan

## Goal

Make the calculator comfortable on touch devices without weakening its large-number capabilities or maintaining a separate mobile application.

## Interaction

- Preserve native focus and keyboard behavior when the expression editor itself is tapped.
- Restore editor focus after keyboard- and mouse-driven calculator actions.
- Do not force editor focus after touch or pen palette actions, so the software keyboard does not cover the palette.
- Preserve the editor selection while it is unfocused so insert, wrap, and backspace actions still operate at the intended caret.

## Responsive History

- Use one History panel and one toolbar implementation at every width.
- Keep a narrow panel-selector rail visible in the lower workbench.
- On desktop, show History by default and let the rail toggle the dock. Persist this view preference.
- On narrow screens, start with History closed and open the same panel as a full-width drawer bounded by the lower workbench.
- Include an accessible close action in the drawer and leave room for future panels in the selector rail.

## Mobile stability

- Retain pinch zoom and user scaling.
- Use a complete viewport declaration including safe-area support.
- Keep editable controls at a mobile-safe font size to prevent focus-triggered browser zoom.
- Normalize browser text-size adjustment rather than suppressing accessibility scaling.

## Verification

- Test mouse, keyboard, touch, and pen focus policy.
- Verify dock visibility persists across reloads on desktop.
- Verify the phone drawer does not cover the active expression or result.
- Verify native editor taps open the software keyboard and palette taps do not.
- Run the complete unit and production build suites.
