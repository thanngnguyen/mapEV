# Design System Document: The Kinetic Eco-System

## 1. Overview & Creative North Star
**Creative North Star: "The Luminous Navigator"**

This design system moves beyond the utility of a map and enters the realm of a premium concierge. To avoid the "generic utility" trap, we employ a philosophy of **Luminous Layering**. Instead of rigid grids and harsh dividers, the UI feels like a series of interconnected, glowing modules floating over a fluid cartographic base. 

The aesthetic is **Organic High-Tech**: it marries the precision of EV technology with the soft, breathable ethos of sustainability. We break the "template" look through:
*   **Maximum Fluidity:** Utilizing pill-shaped geometry and maximum roundedness to mimic organic forms.
*   **Intentional Asymmetry:** Floating search panels offset against map controls.
*   **Depth through Translucency:** Using glassmorphism to ensure the map (the soul of the app) is always visible, even beneath UI layers.
*   **Typography Scale:** Dramatic contrast between technical data points and oversized, editorial headlines.

---

## 2. Colors & Luminous Surface Rules

### Color Palette (Material Design Convention)
*   **Primary (Electric Green):** `#00E676` (The pulse of the system).
*   **Secondary (Deep Slate):** `#263238` (The grounding technical tone).
*   **Surface:** `#F5F7F8` (The "Clean White" base).
*   **Inverse Surface:** `#2e3132` (For high-contrast "Dark Mode" modules).

### The "No-Line" Rule
**Explicit Instruction:** 1px solid borders are strictly prohibited for sectioning content. Boundaries must be defined through:
1.  **Background Shifts:** Place a `surface-container-low` card on a `surface` background.
2.  **Shadow Depth:** Use ambient light to define edges.
3.  **Tonal Transitions:** Using subtle `surface-variant` shifts to group related data.

### The "Glass & Gradient" Rule
To achieve the "High-Tech" requirement, all floating overlays (Map Cards, Search Bars) must use **Glassmorphism**:
*   **Background:** `surface-container-lowest` at 85% opacity.
*   **Effect:** `backdrop-filter: blur(12px)`.
*   **Signature Texture:** Use a linear gradient from `primary` to `primary-container` at a 135-degree angle for main Action Buttons to give them a "charged" energy.

---

## 3. Typography: The Editorial Tech Scale

We use a dual-font strategy to balance "High-Tech" precision with "Eco-Friendly" approachability.

*   **Display & Headlines (Space Grotesk):** This is our "Technical Soul." Its wide stance and geometric apertures feel engineered and modern.
    *   *Display-Lg (3.5rem):* Reserved for empty states or hero statistics.
    *   *Headline-Sm (1.5rem):* Used for Station Names in detail views.
*   **Body & Labels (Inter):** Our "Functional Anchor." Chosen for its exceptional legibility at small sizes (essential for map coordinates and charging speeds).
    *   *Title-Md (1.125rem):* For primary navigation links.
    *   *Body-Md (0.875rem):* For station descriptions and address data.
    *   *Label-Sm (0.6875rem):* For technical specs (e.g., "50kW", "CCS2").

---

## 4. Elevation & Depth: Tonal Layering

Traditional drop shadows are too heavy for an "Eco-Friendly" theme. We use **Tonal Layering** to create a soft, natural lift.

*   **The Layering Principle:** 
    *   **Base Layer:** `surface` (The Map).
    *   **Mid-Level:** `surface-container-low` (Side Panels).
    *   **Top-Level:** `surface-container-lowest` (Floating Cards/Markers).
*   **Ambient Shadows:** If a card requires a "floating" effect (e.g., an active Map Marker), use a blur of `24px`, an opacity of `6%`, and tint the shadow with the `secondary` color rather than pure black.
*   **The "Ghost Border" Fallback:** If accessibility requires a border, use `outline-variant` at **15% opacity**. It should be felt, not seen.

---

## 5. Components

### Map Markers (Signature Component)
Markers are not static pins; they are "Live Cells."
*   **Available:** `primary-container` fill with a subtle outer glow (0 0 12px `primary`).
*   **Busy:** `tertiary-fixed-dim` (a muted amber/orange) to indicate energy in use.
*   **Interaction:** On hover, the marker expands from a dot into a `surface-container-lowest` pill showing the price per kWh.

### Info Cards
*   **Structure:** No dividers. Use `1.5rem` (xl) padding to create "Breathing Room." 
*   **Geometry:** High roundedness (Pill-shaped corners) to maintain the organic high-tech aesthetic.
*   **Visual Grouping:** Use a `surface-container-high` background for the technical specs block within the card to separate it from the station description.

### Status Badges
*   **Shape:** Full Pill-shaped (`rounded-full`).
*   **Style:** No solid fills. Use a soft `primary-container` at 20% opacity with `on-primary-container` text.

### Responsive Navigation
*   **Desktop:** A vertical "Floating Dock" on the left, using Glassmorphism and maximum corner rounding.
*   **Mobile:** A bottom sheet that utilizes `surface-container-lowest` with a large top corner radius to mimic the sleek curves of a modern EV dashboard.

### Input Fields (Search)
*   **Style:** Minimalist. No bottom line or full border. Use `surface-container-high` as a solid fill with `rounded-full` (pill shape). On focus, the background shifts to `surface-container-lowest` with a `2px` "Ghost Border" of `primary`.

---

## 6. Do’s and Don’ts

### Do:
*   **Do** use vertical white space (Normal spacing) to separate the "Search" section from "Recent Locations."
*   **Do** use the `primary-fixed` token for "Available Now" text to give it a vibrant, high-energy feel.
*   **Do** embrace the pill-shaped UI; every container should feel soft and accessible.

### Don’t:
*   **Don’t** use sharp corners or subtle rounding; the system requires a maximum roundedness (3) for its organic feel.
*   **Don’t** use a 100% black (`#000000`) for text. Use `on-surface` to maintain a premium, softer contrast.
*   **Don’t** use traditional "Google Maps Red" for busy stations. Use the `tertiary` palette to keep the color story cohesive and sophisticated.