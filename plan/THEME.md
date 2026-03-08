# Mindful Design System

## Theme: Cyberpunk

### Design Direction
- Deep space dark backgrounds (#0a0a12)
- Neon cyan/magenta accent colors
- Glassmorphism cards with glowing borders
- Terminal/tech aesthetic with monospace fonts
- Scanline and glow effects
- Uppercase tracking for headings

### Color Palette

```css
:root {
  /* Backgrounds - Deep Space */
  --background: 222 47% 6%;        /* #0a0a12 */
  --background-elevated: 222 47% 8%;
  --background-card: 222 47% 10%;
  
  /* Primary - Neon Cyan */
  --primary: 187 100% 50%;         /* #00e5ff */
  --primary-light: 187 100% 70%;
  --primary-dark: 187 100% 40%;
  
  /* Accent - Neon Magenta */
  --accent: 300 100% 50%;
  
  /* Text */
  --foreground: 192 100% 98%;     /* #e6f7ff */
  --foreground-muted: 192 100% 60%;
  
  /* Status Colors */
  --success: 150 70% 60%;
  --warning: 35 100% 60%;
  --error: 0 100% 60%;
  --info: 220 100% 60%;
}
```

### Typography

- **Display Font**: Orbitron (futuristic geometric sans-serif)
- **Body Font**: Space Mono (monospace for tech feel)

### Components

- Cards: Dark glassmorphism with neon border glow
- Hover states: Neon glow effects
- Animations: Staggered fade-in-up on page load
- Borders: 1px with neon glow on hover

### Dark Mode

- Always dark (cyberpunk aesthetic)
- Use `color-scheme: dark` on HTML element
- Custom scrollbar with cyan accent
- Selection color with cyan tint

### Animation Guidelines

- Use Motion library for React animations
- Stagger delays: 100ms between elements
- Duration: 300-500ms for main transitions
- Easing: easeOut for entrance animations
- Glow pulse animations for status indicators

### File Structure

```
client/src/
├── index.css              # Theme variables + base styles
├── App.tsx               # Main app with layout
└── components/
    ├── layout/
    │   ├── DashboardLayout.tsx
    │   ├── Sidebar.tsx
    │   └── Header.tsx
    └── dashboard/
        ├── AgentCards.tsx
        ├── ActivityChart.tsx
        ├── AgentTree.tsx
        └── ActivityFeed.tsx
```

### Usage

Import fonts in `index.css`:
```css
@import "@fontsource/orbitron/400.css";
@import "@fontsource/orbitron/600.css";
@import "@fontsource/space-mono/400.css";
@import "@fontsource/space-mono/700.css";
```

### CSS Classes

- `.font-display` - Orbitron for headings
- `.font-mono` - Space Mono for body/code
- `.text-gradient-cyber` - Neon gradient text
- `.text-glow` - Text glow effect
- `.glow-neon` - Neon box shadow
- `.card-cyber` - Cyberpunk card style
- `.grain-overlay` - Subtle noise texture

### Accessibility

- All interactive elements have visible focus states
- Icons have aria-labels where needed
- Semantic HTML (buttons for actions, links for navigation)
- Sufficient color contrast (4.5:1 minimum)

### Responsive Breakpoints

- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

### Mobile Features

- **Sidebar**: Drawer/overlay on mobile (< 768px), collapsible on desktop
- **Mobile menu button**: Fixed FAB button in bottom-left corner
- **Overlay**: Dark backdrop with blur when menu is open
- **Touch-friendly**: Larger tap targets (min 44px)
- **Adaptive padding**: Smaller padding on mobile (p-3), larger on desktop (p-6)
- **Chart heights**: Reduced height on mobile (h-48), full on desktop (h-64)
- **Hidden elements**: Username text hidden on mobile, keyboard shortcut hidden

### Future Considerations

- Light mode support (toggle)
- Custom themes per user
- Glitch text effects
- Holographic card effects
- Animated scanlines
