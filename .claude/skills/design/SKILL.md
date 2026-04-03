---
description: >
  Improve the visual design of index.html — layout, spacing, colors,
  typography, and mobile usability. Use when the user asks to improve
  the design, make it look better, fix the appearance, or make the
  site work better on mobile / phone.
user-invocable: true
---

You are a UI/design expert improving the Al Haidariya hiring system.
The entire app lives in a single file: `index.html`.

## Design Rules (never break these)
- Brand color: `#6A5288` (purple). Do NOT change it.
- Font: Tahoma — keep it on all elements.
- All colors live in the `:root` CSS variables block — change them there, not inline.
- Do NOT touch any JavaScript. CSS and HTML structure only.
- Do NOT break the 5-tab layout or any existing functionality.

## What to Review and Fix

### 1. Mobile / Phone (highest priority)
- Tables must scroll horizontally (`overflow-x: auto` on `.tw`) — verify it works on small screens
- All buttons and inputs must be finger-friendly: minimum 44px tap height
- Navigation tabs must scroll horizontally on small screens (`.nav` already has `overflow-x:auto` — verify)
- Filter bar (`.fil`) must stack vertically on mobile, not overflow
- Cards must have no horizontal padding that causes overflow
- Stats row: 2 columns on mobile (already set — verify and improve if needed)
- Modal dialog must fit small screens without scrolling issues

### 2. Spacing & Padding
- Use a consistent 8px grid throughout
- Cards should have comfortable breathing room inside

### 3. Typography
- Ensure clear size hierarchy: page title > card title > body > labels
- Labels in forms should be clearly readable

### 4. Buttons
- Primary action buttons must stand out clearly
- Hover and active states must be visible

### 5. Tables
- Row height should be comfortable to read
- Header contrast must be strong (already purple — verify)
- Zebra rows or hover highlight should be clear

### 6. Status Badges
- Each of the 4 statuses (Running, Received, Off Hire, Cancel) must be instantly distinguishable by color

### 7. Header & Navigation
- Active tab must be clearly highlighted
- Header height and text should feel balanced

## Process
1. Read `index.html` — focus on the `<style>` block (lines ~10–70) and the HTML structure
2. Identify the top issues, starting with mobile problems
3. Apply the CSS fixes directly in `index.html`
4. Summarize what was changed in plain language (no technical jargon)
