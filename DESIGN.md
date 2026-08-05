---
name: Activity Tracker
description: Privacy-first Windows activity tracker with a calm, instrument-grade flat system and a legacy glass skin
colors:
  paper: "#faf8f5"
  ink: "#1c1917"
  deep-ink: "#0c0a09"
  chalk: "#fafaf9"
  linen: "#f5f0e8"
  parchment: "#e7e0d5"
  charcoal: "#292524"
  pencil-lead: "#716b66"
  soft-lead: "#a8a29e"
  patina-teal: "#0f766e"
  brass: "#b45309"
  oxblood: "#9f1239"
  amethyst: "#6d28d9"
typography:
  display:
    fontFamily: '"Plus Jakarta Sans Variable", system-ui, sans-serif'
    fontSize: "46px"
    fontWeight: 600
    letterSpacing: "-0.045em"
    lineHeight: 1
    fontFeature: "tnum"
  headline:
    fontFamily: '"Plus Jakarta Sans Variable", system-ui, sans-serif'
    fontSize: "34px"
    fontWeight: 700
    letterSpacing: "-0.035em"
  headline-editorial:
    fontFamily: '"Instrument Serif", Georgia, serif'
    fontSize: "42px"
    fontWeight: 400
    fontStyle: "italic"
    letterSpacing: "-0.01em"
  sub-metric:
    fontFamily: '"Plus Jakarta Sans Variable", system-ui, sans-serif'
    fontSize: "30px"
    fontWeight: 600
    letterSpacing: "-0.04em"
    lineHeight: 1
    fontFeature: "tnum"
  section:
    fontFamily: '"Plus Jakarta Sans Variable", system-ui, sans-serif'
    fontSize: "16px"
    fontWeight: 600
    letterSpacing: "-0.02em"
  row:
    fontFamily: '"Plus Jakarta Sans Variable", system-ui, sans-serif'
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.65
  body:
    fontFamily: '"Plus Jakarta Sans Variable", system-ui, sans-serif'
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: '"JetBrains Mono Variable", ui-monospace, monospace'
    fontSize: "10.5px"
    fontWeight: 400
    letterSpacing: "0.11em"
    lineHeight: 1
  caption:
    fontFamily: '"JetBrains Mono Variable", ui-monospace, monospace'
    fontSize: "9.5px"
    fontWeight: 400
    letterSpacing: "0.1em"
    lineHeight: 1
  caption-sm:
    fontFamily: '"JetBrains Mono Variable", ui-monospace, monospace'
    fontSize: "9px"
    fontWeight: 400
    letterSpacing: "0.08em"
    lineHeight: 1
  unit:
    fontFamily: '"Plus Jakarta Sans Variable", system-ui, sans-serif'
    fontSize: "24px"
    fontWeight: 500
    letterSpacing: "-0.02em"
  meta:
    fontFamily: '"Instrument Serif", Georgia, serif'
    fontSize: "15px"
    fontWeight: 400
    fontStyle: "italic"
  serif:
    fontFamily: '"Instrument Serif", Georgia, serif'
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1.45
    fontStyle: "italic"
rounded:
  xs: "2px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "28px"
  pill: "9999px"
spacing:
  page-gutter: "32px"
  rail: "196px"
  band: "24px"
  gap-sm: "8px"
  gap-md: "16px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    padding: "16px 24px"
  button-secondary:
    backgroundColor: "{colors.linen}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  toggle-on:
    backgroundColor: "{colors.ink}"
    size: "34px x 16px"
    textColor: "{colors.chalk}"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "0"
    padding: "4px 8px"
  status-dot:
    backgroundColor: "{colors.patina-teal}"
    size: "6px"
  metric-value:
    textColor: "{colors.ink}"
    typography: "display"
  nav-active:
    textColor: "{colors.ink}"
    typography: "headline"
---

# Design System: Activity Tracker

## Overview

**Creative North Star: "The Quiet Observatory"**

Activity Tracker presents your digital day the way a well-run observatory presents the night sky: calm, precise, and honest about what it can and cannot measure. The default flat skin is a warm cream-and-stone instrument panel — hairline rules separate full-bleed bands like rows on a ledger, mono uppercase captions annotate every reading, and one 46px metric per cell carries the day's verdict. Nothing glows, nothing floats, nothing distracts from the numbers themselves.

The system's personality is disciplined Swiss instrumentation warmed by a cream-and-stone material palette. Depth is conveyed through 1px rules and tonal surface fills, never shadows; geometry is square by default (the 6px status dot is the only round thing); and interaction is confident and tactile — tabs underline, toggles snap a solid block between stops, buttons press. A legacy glass skin (blur, orbs, rounded cards, shadows) remains available in settings as the alternate visual theme, but the flat skin is the design authority and default.

Editorial reading mode adds a second voice without breaking the instrument: the same numbers, re-narrated in an italic serif lede — "the instrument is always right, and it tells you what it can't measure." Three switchable font pairs (swiss / geist / grotesk) re-skin type globally without touching component styles.

**Key Characteristics:**
- Warm paper-and-ink neutrality with exactly four accents, three visible per screen maximum
- Full-bleed bands separated by 1px rules; no cards, no rounded containers, no shadows in flat mode
- Mono uppercase caption voice for every label, timestamp, and axis; tabular numerals for every metric
- Square geometry; the 6px status dot is the only round thing
- Confident tactile responses: underline tabs, snap toggles, press buttons, hover surface fills
- Strict motion budget: status-dot pulse, number ticks, and nothing else

## Colors

A warm observational palette: cream paper and warm ink in light mode, deep ink and chalk in dark mode, with stone-derived borders and leads throughout. Four accents — teal, amber, rose, violet — carry every semantic signal in the app; they are identical across both themes.

### Primary
- **Patina Teal** (#0f766e): focus. The focus series, positive deltas, deep-work markers, active bars, the focus-calendar ramp, the live tracking dot. The default fill color of every `Bar`. (AA-safe as small text in both themes; deep enough for hairline strokes.)

### Secondary
- **Brass** (#b45309): warning and secondary activity. "Other activity" series, streaks, limits approaching, power draw, cognitive load.

### Tertiary
- **Oxblood** (#9f1239): negative. Negative deltas and the only destructive element in the app — "Clear all activity history."
- **Amethyst** (#6d28d9): supporting hue, used sparingly for a second categorical series only (idle bars, secondary app in a two-app split, timer progress).

### Neutral
- **Paper** (#faf8f5) / **Deep Ink** (#0c0a09): light-mode background / dark-mode background.
- **Ink** (#1c1917) / **Chalk** (#fafaf9): light-mode foreground / dark-mode foreground. Text, primary button fills, active rules.
- **Linen** (#f5f0e8) / **Charcoal** (#292524): surface fill and hover fill in light / dark (light-mode `--surface`, `--secondary`, `--accent`; dark-mode equivalents).
- **Parchment** (#e7e0d5) / **Charcoal** (#292524): 1px rules and borders in light / dark.
- **Pencil Lead** (#716b66) / **Soft Lead** (#a8a29e): muted foreground — secondary text, mono captions, idle indicators, inactive tabs. (Light-mode value darkened from #78716c to reach AA on Linen surfaces.)

### Named Rules
**The Three-Accent Rule.** Max three accents visible on any one screen. Idle, inactive, and empty data use Pencil Lead or Parchment, never a third accent.

**The Never-A-Background Rule.** An accent is never a background fill. Accents appear only as 1–2px strokes, the filled portion of a 2–3px bar, one word of text, or the 6px status dot.

## Typography

**Display Font:** Plus Jakarta Sans Variable (swiss default; alternates: Geist Variable, Space Grotesk Variable)
**Body Font:** Plus Jakarta Sans Variable (same family as display — one sans voice, weight does the work)
**Label/Mono Font:** JetBrains Mono Variable (alternates: Geist Mono Variable, IBM Plex Mono)
**Serif Font:** Instrument Serif (editorial mode only; alternates: Newsreader Variable, Source Serif 4 Variable)

**Character:** One warm geometric-grotesque sans carries all UI text with tight tracking and tabular numerals; a mono voice delivers every caption, timestamp, and axis label in uppercase; an italic serif is reserved for editorial narration. The pairing reads as calibrated rather than decorative — a printed instrument manual that happens to be beautiful.

### Hierarchy
- **Display** (600, 46px, line-height 1, −0.045em, tabular): the primary KPI number on each page — one per metric band cell, never more.
- **Headline** (700, 34px, −0.035em): page titles — "The Pulse", "Timeline". Editorial mode swaps to the serif italic at 42px.
- **Sub-metric** (600, 30px, −0.04em, tabular): secondary numbers — flow score, longest streak, timer reads.
- **Section** (600, 16px, −0.02em): section headings.
- **Row** (400, 12px, line-height 1.65): app names, setting labels, table rows, chart legends.
- **Body** (400, 11.5–13.5px, line-height 1.65–1.75, `text-wrap: pretty`): descriptions, tooltips, settings copy. Max ~65ch for prose passages.
- **Label** (400, 10.5px, +0.11em, uppercase): mono captions — meta lines, axis ticks, table headers, ALL CAPS status lines.
- **Caption** (400, 9.5px, +0.10em, uppercase) and **Caption-sm** (400, 9px, +0.08em, uppercase): tight mono micro-labels — footers, chip text, tray lines.
- **Data value** (700, 10–11px, +0.06em, mono): table figures, durations, percentages.
- **Unit suffix** (500, 24px, −0.02em, Pencil Lead): subordinate to the digits inside a metric (e.g. the `m` in `6h 42m`).
- **Meta** (400 italic serif, 15px): editorial-mode supporting line under the lede.

### Named Rules
**The Two-Voice Rule.** Numbers speak in the sans display voice; captions speak in mono uppercase; prose speaks in the serif. A reading never mixes two voices in one line.

## Layout

A left rail (196px) carries the brand, text-only navigation, and the live tracking footer; the content area is a vertical stack of full-bleed bands separated by 1px Parchment rules, with a 32px page gutter (44px in editorial mode). The metric band is a 4-column grid divided by vertical rules; the main split is `1fr / 300px` (content / narrow tabular column). Tables use fixed grid-template-columns with rule-separated rows; group headers get a full-width 1px Ink rule above the mono caption. Everything is spaced with flex/grid `gap` (8–20px), never margins on children.

## Elevation & Depth

The flat skin is explicitly shadowless: depth is conveyed by tonal layering (Paper → Linen on hover) and 1px rules, never by elevation. Interactive widgets may lift with a faint shadow on hover only; at rest everything is flat. The legacy glass skin carries the full shadow vocabulary (shadow-sm/base/md/lg/xl) plus backdrop blur, floating orbs, and a noise overlay — available only in glass mode.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. No gradients, no glow, no `blur()`, no `box-shadow` on flat-mode surfaces — separation is a 1px rule's job.

## Shapes

The flat skin is square: border-radius 0 everywhere — panels, chips, toggles, bars, the focus calendar's 9×9px cells. Buttons carry a small 6–8px radius and the 6px status dot is the only round object in the system. Selected tabs get a 1.5px Ink underline; active nav items a 2px left rule; locked or empty slots render as 1px dashed Parchment. The glass skin reintroduces rounded cards (12px) and pills for its own components only.

## Components

### Buttons
- **Shape:** small radius (6px sm / 8px md/lg), no border for primary; press scale 0.97 on `:active`.
- **Primary:** Ink fill, Paper text, `shadow-base` resting, lifts to `shadow-md` on hover, opacity 90% on hover.
- **Secondary:** Linen fill, Ink text, 1px Parchment border, darkens to Muted on hover.
- **Ghost:** transparent, Ink text, Linen fill on hover.
- **Destructive:** Oxblood fill (the only destructive color in the app), reserved for "Clear all history."

### Toggle
- **Style (flat):** 34×16px, 1px border (`--toggle-on` when on, Parchment when off), 1px padding, containing a 14×12px square block (`--toggle-on` when on, Parchment when off) justified end/start.
- **Style (glass):** rounded 44×24 track, `--toggle-on` when on, Muted when off; circular white thumb. The `--toggle-on` token is Ink (#1c1917) in light mode and a warm mid-stone (#57534e) in dark mode — never the chalk foreground, so the white thumb stays visible on the ON track in both themes.
- **Motion:** 120–150ms `justify-content` / `left` swap. No animation beyond that.

### Chips
- **Style (flat):** bordered mono tag — 1px Parchment border, 11px uppercase mono with +0.06em tracking, Ink text, square corners, square `×` remove button that turns Oxblood on hover.
- **State:** removable chips for blacklisted apps, redaction keywords, and app filters; selected state uses the Ink border.

### Cards / Containers
- **Corner Style:** 0 (flat). There are no cards in flat mode — regions are 1px-ruled bands.
- **Background:** none; the page background shows through.
- **Shadow Strategy:** none at rest (see Elevation).
- **Border:** 1px Parchment top rule between bands; 1px full border on interactive widgets.
- **Internal Padding:** 22–24px vertical rhythm per band.

### Inputs / Fields
- **Style:** 1px Parchment border, no fill, square corners; flat slider = 1px track with a 3×11px square Ink handle.
- **Focus:** 2px ring (`0 0 0 2px background, 0 0 0 4px ring`) via the global `:focus-visible` rule.

### Navigation
- **Style (flat):** text-only rail, 13px Ink/700 for active, Pencil Lead for inactive; active gets a 2px left Ink rule; hover fills Linen. The "NEW" chip on Tools is a 1px-bordered mono tag in Patina Teal.
- **Segmented controls (glass):** pill track on a Secondary fill with a 1px Parchment border — the border keeps the container visible on the Paper page in light mode, where Secondary fill alone would vanish. Selected pill = Primary fill, Primary-foreground text.
- **Glass variant:** rounded pills with icon, active = Ink fill.

### Signature Components
- **MetricValue:** 46px Display metric with a 24px Pencil Lead unit suffix — the observatory's primary readout.
- **MonoLabel:** 10.5px uppercase mono caption — the annotating voice used across headers, footers, and table heads.
- **StatusDot:** the 6px Patina Teal dot (the only round thing); pulses (`opacity 1→0.35, scale 1→0.82`, 2s ease-in-out, infinite) while tracking is live, Pencil Lead when idle.
- **Bar:** square track in Parchment; fill color defaults to Patina Teal; heights hair (2px) / thin (3px) / thick (6–12px for progress and segments).
- **Panel:** the flat container — a plain block with a 1px top rule and padding; explicitly not a card.
- **EditorialIntro:** italic serif lede (22px, line-height 1.45, max-width 760px) under the header in editorial mode, with a mono supporting line.
- **EmptyState:** centered icon in a Linen circle, Display title, Pencil Lead message — the only rounded container in flat mode.

## Do's and Don'ts

### Do:
- **Do** separate regions with 1px Parchment rules and group headers with 1px Ink rules.
- **Do** set every metric in tabular numerals (`font-variant-numeric: tabular-nums`).
- **Do** write every caption, timestamp, and axis label as mono uppercase.
- **Do** use Patina Teal for focus, Brass for warnings, Oxblood for negatives — and keep at most three accents per screen.
- **Do** show `—` in Pencil Lead at metric size for missing data; one sentence, left-aligned, for empty tables.
- **Do** keep motion to the status dot and number ticks; let tabs, toggles, and hovers respond in 150ms or less.
- **Do** keep the same queries, tokens, and numbers across data and editorial reading modes — only the presentation differs.

### Don't:
- **Don't** add gradients, glow, blur, or box-shadows to flat-mode surfaces.
- **Don't** round flat-mode containers — radius 0 is the rule; the status dot and the EmptyState circle are the exceptions.
- **Don't** use an accent as a background fill, and don't introduce a third accent for idle or empty states (use Pencil Lead / Parchment).
- **Don't** use icons in the content area — lucide glyphs belong only in the rail and the header refresh control.
- **Don't** animate entrances, spring layouts, or chart draw-ons in flat mode.
- **Don't** pad chart axes past the last data hour.
- **Don't** let the shared `Button` component's small radius leak into flat containers — buttons may be slightly rounded; bands, chips, and bars stay square.
