# Design System Strategy: The Editorial Intelligence

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Digital Archivist."**

Unlike generic SaaS platforms that prioritize frantic utility and "busy" dashboards, this system treats voice data as a sacred text. The goal is to move away from the "app-like" feel toward a high-end editorial experience—think of a digital version of a bespoke linen notebook or a premium broadsheet newspaper.

We achieve this by breaking the rigid, boxy grid of standard dashboards. We use **intentional asymmetry**, where content isn't always perfectly centered or boxed, and **high-contrast typography scales** to guide the eye. By utilizing wide margins (the `16` to `24` spacing tokens) and overlapping layers, we create a sense of breathing room and intellectual prestige.

---

## 2. Colors & Surface Philosophy
This palette is grounded in the "warm dark" spectrum, moving away from sterile blue-blacks toward deep charcoals and umbers.

### Color Tokens

| Token | Hex | Usage |
|-------|-----|-------|
| `surface` | #131312 | Base background ("the desk") |
| `surface-container-lowest` | #0e0e0d | Recessed elements (inputs, secondary lists) |
| `surface-container-low` | #1c1c1b | Sidebar, card backgrounds |
| `surface-container` | #20201f | Active workspace |
| `surface-container-high` | #2a2a29 | Hover states, active segments |
| `surface-container-highest` | #353533 | Overlays, modals, dropdowns |
| `on-surface` | #e5e2e0 | Primary text |
| `on-surface-variant` | #dec0b6 | Secondary text, labels |
| `primary` | #ffb59c | Primary accent (soft coral) |
| `primary-container` | #ff7f50 | Primary CTA fills (coral) |
| `secondary` | #ffe2ab | Waveform peaks, focus states (amber) |
| `secondary-container` | #ffbf00 | Secondary highlights (gold) |
| `tertiary` | #c7c6c4 | Neutral accent |
| `tertiary-container` | #a4a4a2 | Tag/chip backgrounds |
| `on-tertiary` | #303130 | Tag/chip text |
| `outline` | #a68b82 | Subtle borders (use sparingly) |
| `outline-variant` | #57423b | Ghost borders (15% opacity) |
| `error` | #ffb4ab | Error text |
| `error-container` | #93000a | Error backgrounds |

### The "No-Line" Rule
Traditional 1px solid borders are strictly prohibited for sectioning. Instead, define boundaries through:
- **Background Shifts:** Place a `surface-container-low` card on a `surface` background.
- **Tonal Transitions:** Use the contrast between `surface-container` and `surface-container-highest` to separate the sidebar from the main workspace.

### The "Glass & Gradient" Rule
For floating playback bars or "Live Recording" monitors, use `surface-container-high` at 80% opacity with a `backdrop-filter: blur(20px)`.
- **Signature Textures:** For the primary CTA (Start Recording), use a subtle linear gradient from `primary` (#ffb59c) to `primary-container` (#ff7f50).

---

## 3. Typography
The tension between the serif and sans-serif fonts creates the "Editorial" feel.

| Scale | Font | Weight | Size | Usage |
|-------|------|--------|------|-------|
| display-lg | Newsreader | 300 (Light) | 3.5rem | Hero text, app name |
| headline-lg | Newsreader | 400 | 2rem | Page titles, note titles |
| headline-md | Newsreader | 400 | 1.75rem | Section headers |
| title-lg | Inter | 500 | 1.375rem | Card titles, nav items |
| title-md | Inter | 500 | 1rem | Sub-headers |
| body-lg | Inter | 400 | 1rem | Transcript text, descriptions |
| body-md | Inter | 400 | 0.875rem | General content |
| label-lg | Inter | 500 | 0.875rem | Button text, form labels |
| label-md | Inter | 500 | 0.75rem | Metadata, timestamps (uppercase, letter-spaced) |
| label-sm | Inter | 400 | 0.6875rem | Captions, footnotes |

**Hierarchy Tip:** A `headline-lg` title in Newsreader paired with a `label-md` date in Inter (all caps, letter-spaced) creates an immediate high-end magazine aesthetic.

---

## 4. Elevation & Depth
Depth is a whisper, not a shout. We use **Tonal Layering** rather than traditional structural lines.

- **The Layering Principle:** Stack `surface-container-lowest` elements within a `surface-container` area to create a "recessed" look for input fields or secondary lists.
- **Ambient Shadows:** When an element must float (e.g., a context menu), use a shadow color tinted with `on-surface` at 6% opacity. Set the blur to a minimum of `32px` to mimic soft gallery lighting.
- **The "Ghost Border" Fallback:** If a border is required for accessibility, use the `outline-variant` at **15% opacity**. It should be barely perceptible—a hint of an edge, not a cage.

---

## 5. Components

### The Recording Button (Primary CTA)
- **Style:** Pill-shaped (`rounded-full`).
- **Color:** Gradient of `primary` to `primary-container`.
- **State:** On hover, add a soft `primary` outer glow (8px blur, 20% opacity) to simulate the "on" state of a recording light.

### Transcripts (Cards & Lists)
- **Strict Rule:** No divider lines between list items. Use `1.4rem` of vertical white space to separate entries.
- **Active State:** Instead of a border, use a subtle background shift to `surface-container-high`.

### Input Fields & Search
- **Style:** Minimalist. No background fill. Only a "Ghost Border" at the bottom of the field.
- **Focus State:** The border transitions to `secondary` (#ffe2ab) at 100% opacity.

### Audio Waveform Component
- **Style:** Use the `secondary` (#ffe2ab) color for the waveform peaks. The background of the waveform container should be `surface-container-lowest`.

### Chips & Tags
- **Style:** `rounded-sm` (0.125rem) to keep them feeling "architectural" rather than bubbly. Use `tertiary-container` for the background with `on-tertiary` for text.

### Stat Cards
- **Style:** `surface-container-low` background, no border. Icon + count + label stacked vertically. Icon uses `primary` color.

### Status Badges
- Completed: `secondary` text, no background
- Processing: `primary` text with subtle pulse animation
- Failed: `error` text

---

## 6. Do's and Don'ts

### Do
- **Do** use asymmetrical layouts where appropriate.
- **Do** lean into the warm tones. Ensure your "warm grays" don't accidentally drift into cold "SaaS Blue."
- **Do** use generous spacing (5.5rem+ top-level padding) to give the dashboard a "gallery" feel.
- **Do** use Newsreader for headings, Inter for everything else.

### Don't
- **Don't** use pure black (#000000). It kills the editorial warmth. Stick to `surface` (#131312).
- **Don't** use high-contrast shadows. If you can see the edge of the shadow, it's too dark.
- **Don't** use icons as the primary way to communicate. Let the Typography (Newsreader) do the heavy lifting; icons should be small, 1.5pt line-weight accents.
- **Don't** use 1px solid borders for sectioning. Use tonal layering instead.
- **Don't** use a standard 12-column grid. Try a 5-column or 3-column "bookish" layout.

---

## 7. Stitch Screen Reference

| Screen | Stitch ID | Description |
|--------|-----------|-------------|
| Dashboard | `a0a457bc32f74d659be4fc299abae4ce` | Stat cards, storage bar, notes grid |
| Recording | `06b4e73822414c998f4ac88d3f8b6444` | Immersive mic button, waveform, controls |
| Note Detail | `66113136b4f04ce9b8716831ecb8c34b` | Two-column: audio player + transcription |
| Login | `dd4b91548dbf4098944c45ebf3e30e8e` | Centered card, ghost inputs, ambient glow |
| Settings | `0a8a1eac42cc47bcbf7de5479a3a2cdb` | Three-section form, storage bar |

Stitch Project ID: `8840700831410871660`
