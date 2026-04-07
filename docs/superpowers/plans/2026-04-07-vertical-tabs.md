# Vertical Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the horizontal tab bar to a vertical left sidebar on desktop (>768px), keeping mobile layout unchanged.

**Architecture:** Add a `#sidebar` element before `#terminal-container` in the DOM. On desktop, body switches to `flex-direction: row`, sidebar is 200px wide, terminal takes remaining space. On mobile, sidebar is hidden and existing `#header` with horizontal tabs is used. Sidebar visibility is toggled via button and persisted in localStorage.

**Tech Stack:** HTML/CSS/JS (single-file SPA at `public/index.html`)

---

### Task 1: Add sidebar HTML structure

**Files:**
- Modify: `public/index.html:757-770`

- [ ] **Step 1: Add `#sidebar` element before `#terminal-container`**

Insert the sidebar between `<body>` and `<div id="terminal-container">`. The sidebar contains a header with toggle button, a tab container, and action buttons cloned from the header.

At line 757, after `<body>`, insert:

```html
<div id="sidebar">
  <div id="sidebar-header">
    <button id="sidebar-toggle" title="Hide sidebar">&#171;</button>
  </div>
  <div id="sidebar-tabs"></div>
  <div id="sidebar-actions">
    <button id="sidebar-btn-add-window" title="Add floating window">&#x25A3; Window</button>
    <button id="sidebar-btn-new" title="New connection">+ Connect</button>
  </div>
</div>
```

- [ ] **Step 2: Add sidebar open button inside `#terminal-container`**

Right after the `<div id="terminal-container">` opening tag (line 758), add:

```html
<button id="sidebar-open-btn" title="Show sidebar">&#9776;</button>
```

- [ ] **Step 3: Verify the page still loads without errors**

Open the page in a browser. The sidebar will be unstyled but the page should render without JS errors. The existing horizontal tabs should still function.

- [ ] **Step 4: Commit**

```bash
git add public/index.html
git commit -m "feat: add sidebar HTML structure for vertical tabs"
```

---

### Task 2: Add sidebar CSS styles

**Files:**
- Modify: `public/index.html:11-755` (inside `<style>` tag)

- [ ] **Step 1: Add sidebar base styles**

Insert after the `#btn-add-window:active` rule (after line 419), before the `/* --- Empty State --- */` comment:

```css
/* --- Sidebar (Desktop Vertical Tabs) --- */
#sidebar {
  display: none;
  flex-direction: column;
  width: 200px;
  flex-shrink: 0;
  background: #1c1c1e;
  border-right: 1px solid rgba(255,255,255,0.08);
  overflow: hidden;
}
#sidebar-header {
  display: flex;
  justify-content: flex-end;
  padding: 8px;
  flex-shrink: 0;
}
#sidebar-toggle {
  background: transparent;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px;
  color: #98989d;
  font-size: 14px;
  cursor: pointer;
  padding: 2px 8px;
  line-height: 1;
  transition: all 0.15s;
}
#sidebar-toggle:hover { color: #e5e5e7; background: rgba(255,255,255,0.06); }
#sidebar-tabs {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 8px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.1) transparent;
}
#sidebar-tabs::-webkit-scrollbar { width: 4px; }
#sidebar-tabs::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
#sidebar-tabs .tab {
  width: 100%;
  border-radius: 8px;
}
#sidebar-tabs .tab .tab-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}
#sidebar-actions {
  padding: 8px;
  border-top: 1px solid rgba(255,255,255,0.08);
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-shrink: 0;
}
#sidebar-actions button {
  width: 100%;
  padding: 6px 12px;
  border: none;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
  font-family: inherit;
}
#sidebar-btn-new {
  background: #34c759;
  color: #fff;
}
#sidebar-btn-new:hover { background: #30d158; }
#sidebar-btn-add-window {
  background: #5e9eff;
  color: #fff;
  display: none;
}
#sidebar-btn-add-window:hover { background: #4a8af0; }
#sidebar-open-btn {
  display: none;
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 10;
  background: rgba(28,28,30,0.85);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px;
  color: #98989d;
  font-size: 16px;
  cursor: pointer;
  padding: 4px 8px;
  line-height: 1;
  transition: all 0.15s;
}
#sidebar-open-btn:hover { color: #e5e5e7; background: rgba(28,28,30,1); }
```

- [ ] **Step 2: Add desktop media query for sidebar layout**

Insert a new media query after the existing mobile `@media (max-width: 768px)` block for `#header` (after line 54). Add inside the `<style>` tag, near the top where body styles are:

```css
@media (min-width: 769px) {
  body {
    flex-direction: row;
  }
  #sidebar {
    display: flex;
  }
  #sidebar.hidden {
    display: none;
  }
  #sidebar.hidden ~ #terminal-container #sidebar-open-btn {
    display: block;
  }
  #header {
    display: none;
  }
}
```

- [ ] **Step 3: Verify sidebar appears on desktop, hidden on mobile**

Open the page at desktop width. Sidebar should be visible on the left (200px wide, dark background). Resize to mobile width — sidebar disappears, header with horizontal tabs appears.

- [ ] **Step 4: Commit**

```bash
git add public/index.html
git commit -m "feat: add sidebar CSS for desktop vertical tab layout"
```

---

### Task 3: Wire up `renderTabs()` to target sidebar on desktop

**Files:**
- Modify: `public/index.html:1926-1961` (renderTabs and updateTabLayout functions)
- Modify: `public/index.html:1469` (DOM refs section)

- [ ] **Step 1: Add sidebar DOM refs**

At line 1469, after the `const tabBar = ...` line, add:

```javascript
const sidebar = document.getElementById('sidebar');
const sidebarTabs = document.getElementById('sidebar-tabs');
```

- [ ] **Step 2: Modify `renderTabs()` to render to correct container**

Replace the `renderTabs()` function (lines 1926-1952) with:

```javascript
function renderTabs() {
  const isDesktop = window.innerWidth > 768;
  const target = isDesktop ? sidebarTabs : tabBar;
  const savedScrollLeft = tabBar.scrollLeft;
  // Clear both containers
  tabBar.innerHTML = '';
  sidebarTabs.innerHTML = '';
  tabBar.classList.remove('scrollable');
  let tabIdx = 0;
  for (const [id, s] of termSessions) {
    tabIdx++;
    const tab = document.createElement('div');
    tab.className = `tab${id === activeSessionId ? ' active' : ''}`;
    tab.dataset.sessionId = id;
    const label = `${s.config.username || ''}@${s.config.host || ''}`;
    const numberBadge = tabIdx <= 9 ? `<span class="tab-number">${tabIdx}</span>` : '';
    tab.innerHTML = `
      ${numberBadge}
      <span class="tab-label">${label}</span>
      <span class="close-btn" title="Close">&times;</span>
    `;
    tab.querySelector('.tab-label').addEventListener('click', () => activateSession(id));
    tab.querySelector('.close-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      closeSession(id);
    });
    target.appendChild(tab);
  }
  if (!isDesktop) {
    updateTabLayout();
    tabBar.scrollLeft = savedScrollLeft;
  }
}
```

- [ ] **Step 3: Guard `updateTabLayout()` for mobile only**

The existing `updateTabLayout()` function (lines 1954-1961) stays as-is. It already operates on `tabBar` which is only populated on mobile now.

- [ ] **Step 4: Verify tabs appear in sidebar on desktop, in tab bar on mobile**

Open the page, connect to a server. On desktop, the tab should appear in the left sidebar. Resize to mobile — tabs move to the bottom header.

- [ ] **Step 5: Commit**

```bash
git add public/index.html
git commit -m "feat: render tabs to sidebar on desktop, tab-bar on mobile"
```

---

### Task 4: Wire up sidebar action buttons and toggle

**Files:**
- Modify: `public/index.html` (JS section, after DOM refs ~line 1471)

- [ ] **Step 1: Add sidebar button event listeners**

After the existing DOM refs section (around line 1476), add:

```javascript
// --- Sidebar ---
const sidebarOpenBtn = document.getElementById('sidebar-open-btn');
const sidebarToggle = document.getElementById('sidebar-toggle');
const SIDEBAR_VISIBLE_KEY = 'ssh-sidebar-visible';

document.getElementById('sidebar-btn-new').addEventListener('click', () => showConnectDialog());
document.getElementById('sidebar-btn-add-window').addEventListener('click', () => {
  if (activeSessionId) createFloatingWindow(activeSessionId);
});

function toggleSidebar() {
  const isHidden = sidebar.classList.toggle('hidden');
  localStorage.setItem(SIDEBAR_VISIBLE_KEY, !isHidden);
  sidebarToggle.innerHTML = isHidden ? '&#187;' : '&#171;';
  // Refit terminals after layout change
  requestAnimationFrame(() => {
    for (const [, s] of termSessions) {
      s.fitAddon.fit();
    }
    // Also refit floating windows
    for (const [, s] of termSessions) {
      if (s.floatingWindows) {
        for (const [, fw] of s.floatingWindows) {
          if (fw.fitAddon) fw.fitAddon.fit();
        }
      }
    }
  });
}

sidebarToggle.addEventListener('click', toggleSidebar);
sidebarOpenBtn.addEventListener('click', toggleSidebar);

// Restore sidebar state
if (localStorage.getItem(SIDEBAR_VISIBLE_KEY) === 'false') {
  sidebar.classList.add('hidden');
  sidebarToggle.innerHTML = '&#187;';
}
```

- [ ] **Step 2: Update `updateAddWindowButton()` to also show/hide sidebar button**

Find the `updateAddWindowButton()` function (search for `function updateAddWindowButton`). Add a line to also toggle the sidebar version. The function currently toggles `#btn-add-window` display. Add after the existing line:

```javascript
const sidebarAddBtn = document.getElementById('sidebar-btn-add-window');
if (sidebarAddBtn) sidebarAddBtn.style.display = termSessions.size > 0 ? 'block' : 'none';
```

- [ ] **Step 3: Verify sidebar toggle works**

Click the `<<` button in the sidebar — it should hide. The hamburger button should appear at top-left of the terminal area. Click it — sidebar reappears. Reload the page — state is preserved.

- [ ] **Step 4: Verify sidebar action buttons work**

Click "+ Connect" in the sidebar — connect dialog opens. Connect to a server, then click the window button — floating window opens.

- [ ] **Step 5: Commit**

```bash
git add public/index.html
git commit -m "feat: wire sidebar toggle, action buttons, and state persistence"
```

---

### Task 5: Update keyboard shortcuts and resize handling

**Files:**
- Modify: `public/index.html:2950-2961` (keyboard shortcuts)
- Modify: `public/index.html:1998` (resize handler)

- [ ] **Step 1: Update tab switching keyboard shortcut selector**

Replace the keyboard shortcut section (lines 2950-2960) that handles Cmd/Alt+1-9:

```javascript
// Cmd+1-9 (Mac) / Alt+1-9 (other): switch tabs
const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? e.metaKey : e.altKey;
if (mod && e.key >= '1' && e.key <= '9') {
  e.preventDefault();
  const isDesktop = window.innerWidth > 768;
  const tabs = document.querySelectorAll(isDesktop ? '#sidebar-tabs .tab' : '#tab-bar .tab');
  const idx = parseInt(e.key) - 1;
  if (idx < tabs.length) {
    const sessionId = tabs[idx].dataset.sessionId;
    if (sessionId) activateSession(sessionId);
  }
}
```

- [ ] **Step 2: Update resize handler to re-render tabs on breakpoint crossing**

Replace line 1998:

```javascript
let wasDesktop = window.innerWidth > 768;
window.addEventListener('resize', () => {
  const isDesktop = window.innerWidth > 768;
  if (isDesktop !== wasDesktop) {
    wasDesktop = isDesktop;
    renderTabs();
    updateAddWindowButton();
  }
  updateTabLayout();
  fitActiveTerminal();
});
```

- [ ] **Step 3: Verify keyboard shortcuts work on both layouts**

On desktop, press Cmd+1 (Mac) or Alt+1 — first tab activates. Resize to mobile, same shortcut works with horizontal tabs.

- [ ] **Step 4: Verify resize transition**

Slowly resize the browser from desktop to mobile width. At 768px, tabs should move from sidebar to horizontal bar. Resize back — tabs return to sidebar.

- [ ] **Step 5: Commit**

```bash
git add public/index.html
git commit -m "feat: update keyboard shortcuts and resize handling for vertical tabs"
```

---

### Task 6: Final cleanup and edge cases

**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: Ensure empty state shows correctly**

When no sessions exist, the sidebar should still show the "+ Connect" button but no tabs. The "Add Window" button should be hidden. Verify the empty state message still appears in the terminal area.

- [ ] **Step 2: Ensure sidebar tab scrolling works with many tabs**

Open 10+ connections. The sidebar tab area should scroll vertically. The action buttons at the bottom should remain fixed (not scroll with tabs).

- [ ] **Step 3: Verify floating windows are unaffected**

Create a floating window. Toggle the sidebar open/closed. The floating window should remain positioned correctly within the terminal container. The window should refit its terminal on sidebar toggle.

- [ ] **Step 4: Verify mobile is completely unchanged**

On mobile width (<=768px):
- Sidebar is hidden
- Sidebar open button is hidden
- Header with horizontal tabs works as before
- Header toggle (show/hide) works as before
- Mobile toolbar works as before

- [ ] **Step 5: Commit final state**

```bash
git add public/index.html
git commit -m "feat: complete vertical tabs implementation"
```
