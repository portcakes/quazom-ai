// Single source of truth for the email palette + typography. Mirrors the
// tokens in `packages/ui/src/styles/globals.css` (oklch values converted to
// sRGB hex so older email clients without oklch support render correctly).
//
// If you change the app theme, re-run the conversion (see git history of
// this commit for the exact formula) and update the values here.
export const palette = {
  background: "#f5f1e6", // warm cream — page background
  card: "#fffcf5", // near-white cream — card surface
  foreground: "#4a3f35", // warm dark brown — primary text
  mutedFg: "#7d6b56", // softer warm brown — secondary/footer text
  muted: "#ece5d8", // warm beige — subtle fill
  border: "#dbd0ba", // warm beige border
  borderSoft: "#e6dbc6", // border at lower contrast for nested cards
  primary: "#a67c52", // warm camel — accent / italic emphasis
  primaryDark: "#8a6743", // primary one shade darker (button hover-ish)
  primaryFg: "#ffffff", // text on primary fills
  primaryTint: "#f3ead9", // very faint primary wash (badges, soft cards)
  accent: "#d4c8aa", // warm sand
} as const;

// Email-safe font stacks. We hint Libre Baskerville / IBM Plex Mono via
// React Email's `<Font>` component in BrandedLayout (loaded from Google
// Fonts), and these stacks provide the system fallbacks for clients that
// strip web fonts (Outlook Windows, some webmail).
export const fontStacks = {
  serif:
    '"Libre Baskerville", "Lora", Georgia, "Times New Roman", Times, serif',
  mono:
    '"IBM Plex Mono", "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace',
} as const;
