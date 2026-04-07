# Vertical Tabs Design Spec

## Overview

Change the tab bar from horizontal (top header) to a vertical sidebar on the left side for desktop. Mobile retains the current horizontal tab layout.

## Requirements

- Desktop (>768px): Left sidebar with vertical tab list, toggle button to show/hide
- Mobile (<=768px): Current horizontal tab bar at bottom, unchanged
- Tab content: Same as current (number badge, user@host label, close button)
- Sidebar open/close state persisted in localStorage

## Layout

### Desktop (>768px)

```
+------------+-------------------------------+
| Sidebar    |    Terminal Area               |
| (200px)    |    (remaining width)           |
|            |                               |
| [1] usr@h  |                               |
| [2] usr@h  |                               |
| [3] usr@h  |                               |
|            |                               |
| ---------- |                               |
| [+ Connect]|                               |
| [+ Window] |                               |
+------------+-------------------------------+
```

- Body: `display: flex; flex-direction: row`
- Sidebar: `width: 200px; flex-shrink: 0; flex-direction: column`
  - Tab list area: `flex: 1; overflow-y: auto` (vertical scroll when many tabs)
  - Action buttons: fixed at bottom of sidebar
  - Toggle button: top-right of sidebar (e.g. `<<` icon)
- Terminal container: `flex: 1` (takes remaining width)
- When sidebar is closed: `display: none`, terminal takes full width
- When sidebar is closed: a small open button appears at top-left of terminal area

### Mobile (<=768px)

No changes. Current layout preserved:
- `flex-direction: column-reverse` on body
- Horizontal tab bar in `#header` at bottom
- Toggleable via existing header-toggle button

## HTML Changes

### New elements

```html
<div id="sidebar">
  <div id="sidebar-header">
    <button id="sidebar-toggle" title="Toggle sidebar">&#171;</button>
  </div>
  <div id="sidebar-tabs"></div>
  <div id="sidebar-actions">
    <!-- Move "New Connection" and "Add Window" buttons here for desktop -->
  </div>
</div>
```

### Sidebar open button (when sidebar is closed)

```html
<button id="sidebar-open-btn" title="Open sidebar">&#9776;</button>
```

Placed inside or adjacent to `#terminal-container`, positioned top-left.

### Existing elements

- `#header` and `#tab-bar`: Retained for mobile use, hidden on desktop via CSS
- `#terminal-container`: No structural changes

## CSS Changes

### Desktop media query (min-width: 769px)

```css
body {
  flex-direction: row;  /* override column-reverse */
}

#sidebar {
  display: flex;
  flex-direction: column;
  width: 200px;
  flex-shrink: 0;
  background: #1c1c1e;
  border-right: 1px solid rgba(255,255,255,0.08);
}

#sidebar.hidden {
  display: none;
}

#sidebar-tabs {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
}

#sidebar-tabs .tab {
  /* Similar to current .tab styles but full-width */
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  /* Existing color/hover/active styles carry over */
}

#sidebar-actions {
  padding: 8px;
  border-top: 1px solid rgba(255,255,255,0.08);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

#sidebar-open-btn {
  display: none;  /* shown only when sidebar is hidden */
}

#sidebar.hidden ~ #terminal-container #sidebar-open-btn,
body.sidebar-hidden #sidebar-open-btn {
  display: block;
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 10;
}

#header {
  display: none;  /* hidden on desktop, sidebar replaces it */
}
```

### Mobile media query (max-width: 768px)

```css
#sidebar {
  display: none !important;  /* hidden on mobile */
}

#sidebar-open-btn {
  display: none !important;
}

/* #header styles unchanged */
```

## JavaScript Changes

### `toggleSidebar()`

New function:
- Toggles `#sidebar` `.hidden` class
- Saves state to `localStorage` key `ssh-sidebar-visible` (`'true'` / `'false'`)
- After toggle, calls `fitAddon.fit()` on all active terminals (via `requestAnimationFrame`)
- Updates toggle button icon (`<<` when open, `>>` or hamburger when closed)

### `renderTabs()`

Modified to render to different targets:
- Desktop (>768px): Render tabs into `#sidebar-tabs`
- Mobile (<=768px): Render tabs into `#tab-bar` (current behavior)
- Detection: `window.innerWidth > 768`

### `updateTabLayout()`

- Desktop: No-op (vertical scroll handles overflow naturally)
- Mobile: Current logic preserved (horizontal scroll threshold)

### Keyboard shortcuts (Cmd/Alt+1-9)

- Update selector from `#tab-bar .tab` to also check `#sidebar-tabs .tab`
- Or use a helper that returns the correct container based on viewport

### Resize handling

- On `window.resize`, detect crossing the 768px boundary
- When crossing: call `renderTabs()` to move tabs to correct container
- When crossing to desktop: restore sidebar state from localStorage
- When crossing to mobile: ensure `#header` is available

### Initialization (`init()`)

- Read `ssh-sidebar-visible` from localStorage (default: `true`)
- Apply initial sidebar state
- Render tabs to appropriate container based on viewport width

## Scope exclusions

- Server-side changes: None required
- Session management logic: Unchanged
- Floating windows: Unaffected (positioned relative to `#terminal-container`)
- Tab drag-and-drop / reordering: Not in scope
