# Dashboard Screenshots

This folder contains visual regression test screenshots for the Mindful dashboard.

## Screenshots

- `mindmap-view.png` - Mindmap-style agent hierarchy visualization
- Test at various viewport sizes: mobile (375px), tablet (768px), desktop (1440px), wide (1920px)
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
