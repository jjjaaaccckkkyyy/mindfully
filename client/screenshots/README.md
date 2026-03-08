# Dashboard Screenshots

This folder contains visual regression test screenshots for the Mindful dashboard.

## Screenshots

| File | Description | Viewport |
|------|-------------|----------|
| `desktop.png` | Full desktop view with expanded sidebar | 1920x1080 |
| `mobile.png` | Mobile view with hamburger menu | 375x667 |
| `sidebar-collapsed.png` | Desktop with collapsed sidebar | 1920x1080 |
| `sidebar-expanded.png` | Desktop with expanded sidebar (hover state) | 1920x1080 |

## Taking Screenshots

Use agent-browser for visual testing:

```bash
# Desktop view
npx agent-browser open http://localhost:5173 --viewport-width 1920 && \
  npx agent-browser screenshot client/screenshots/desktop.png

# Mobile view
npx agent-browser open http://localhost:5173 --viewport-width 375 && \
  npx agent-browser screenshot client/screenshots/mobile.png

# Sidebar states
npx agent-browser open http://localhost:5173 && \
  npx agent-browser click @collapse-button && \
  npx agent-browser screenshot client/screenshots/sidebar-collapsed.png
```

## Testing Checklist

- [ ] Desktop layout (1920px+)
- [ ] Tablet layout (768px-1024px)
- [ ] Mobile layout (<768px)
- [ ] Sidebar collapse/expand
- [ ] Hover states
- [ ] All components visible
- [ ] Responsive grids
- [ ] Touch interactions (mobile)
