# Release 15.04.2026

## iDev CRM — UI/UX Foundation Improvements

### Dark Theme
- Full dark theme support via `data-theme="dark"` attribute on `<html>`
- CSS token bridge: idev-ui design system tokens (`--bg`, `--surface`, etc.) mapped to CRM component names
- Theme preference persisted in localStorage across sessions
- Toggle button (moon/sun icon) in header

### Sidebar Collapse
- Desktop sidebar can be collapsed to 64px icon-only mode
- Collapse state persisted in localStorage
- Toggle button (arrow chevron) in header
- Smooth CSS transition between expanded (240px) and collapsed modes
- Tooltips on nav icons in collapsed state

### Navigation Redesign
- Replaced emoji icons with proper SVG icons across all nav items
- Added user info panel at sidebar bottom (avatar, name, email, logout)
- Logo redesigned with icon + text

### Header Improvements
- Added user avatar (initials-based) replacing text-only display
- Dark mode toggle button
- Desktop sidebar collapse button
- Cleaner layout with proper spacing

### Dashboard
- KPI cards redesigned with icon badges and proper visual hierarchy
- Chart shows "no data" empty state when funnel is empty
- Improved chart tooltip styling (respects theme colors)
- "Sales funnel" badge showing total deal count

### Seed Data
- Added `seed_demo` management command for demo data
- 15 clients across IT, Finance, E-commerce, Healthcare, Retail industries
- 20 deals across all pipeline stages ($14K–$150K values)
- 10 tasks with varied priorities and statuses

### Build System
- Fixed idev-ui TypeScript/JSX compatibility with Vite (resolve aliases, `@ts-nocheck`)
- Removed Next.js-specific `'use client'` directives from idev-ui components
- Vite config: `resolve.alias` ensures React resolved from CRM's node_modules
- `vite build` used directly (TypeScript check runs separately)
