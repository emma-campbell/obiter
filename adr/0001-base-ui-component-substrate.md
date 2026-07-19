# ADR 0001 — Base UI as the component substrate

Status: accepted · 2026-07-19

## Context

The app's UI was built two ways at once. Nearly every component styled itself
with inline `CSSProperties` objects that reference the design tokens
(`var(--ink)`, `var(--u-2)`, …), with interactive states hand-rolled in JS —
`Button` and `IconButton` fake `:hover` with `useState` +
`onMouseEnter`/`onMouseLeave`. Only `Editor.css` used class-based CSS, and only
because it styles ProseMirror's generated DOM, which can't take React inline
styles.

Inline style objects can't express `:hover`, `:focus-visible`, `:active`,
pseudo-elements, or media queries — so every interactive state becomes a JS
workaround. And the behaviour-heavy surfaces were hand-rolled and only
partly accessible: the Settings modal has `role="dialog"` but no focus trap, no
focus restoration, and no Escape-to-close; the command palette drives itself off
a window `keydown` listener; the file tree has no tree semantics at all.

The motivation for change is **behaviour and accessibility** first — real focus
management, keyboard navigation, and ARIA — not styling ergonomics.

## Decision

Adopt **Base UI** (`@base-ui/react`) as the component substrate for the whole
app, and retire inline-style-object styling.

Base UI reached 1.0 in December 2025, is maintained by the MUI team, is
unstyled (styled via `className` + `[data-*]` state selectors), tree-shakable,
npm-installed (no CDN / no phone-home), and React-native. It gives us the
behaviour and accessibility we're after while leaving the ink-on-paper brand
entirely to our own CSS.

Alternatives considered and rejected:

- **0build** — a styled, framework-agnostic, CDN-delivered kit. Collides with
  three of our constraints: it mutates the DOM imperatively (fights React 19),
  it's a runtime CDN dependency (the app must not phone home), and it ships its
  own visual language (fights the bespoke brand). Wrong category — a styled kit,
  not headless primitives.
- **Radix UI** — the former default, effectively superseded; Base UI is its
  successor.
- **React Aria Components** — the most rigorous a11y, but `react-aria-components`
  is ~165 KB; heavier than we need for a personal notes app.

### Conventions

- **Wrapper pattern.** Call sites keep going through our own
  `src/components/core/*` components. Each wrapper's _internals_ are
  reimplemented on its Base UI primitive; the component API stays stable so call
  sites don't change. Brand styling for a component lives in exactly one place —
  its wrapper.
- **Styling.** Co-located `Component.css` per wrapper (the `Editor.css`
  pattern), styling Base UI parts via `className` and `[data-*]` state
  selectors. No inline-style objects.
- **Tokens.** Unchanged. `styles/tokens/*.css` stay the single source of truth;
  Base UI is unstyled, so nothing about the palette or spacing moves.

## Consequences

- The inline-style-object pattern (and its `useState` hover hacks) is retired
  app-wide in favour of one convention: Base UI + brand CSS.
- The migration is sliced **by primitive** (smallest independently-shippable
  bits), sequenced Toast → Button → Switch → Select → Field/Input →
  Dialog+Tabs → Toolbar → Combobox → Tooltip → Tree. Each slice reimplements one
  wrapper on its Base UI primitive with its CSS and tests. Filed as sub-issues of
  #52.
- **One gap:** Base UI has no Tree primitive. The file tree is the last and
  largest slice, building `role=tree` / roving-tabindex / arrow-key navigation
  on top of Base UI's **Collapsible**.
- `Icon` (a Lucide wrapper) and `Kbd` have no Base UI equivalent and stay as they
  are.
