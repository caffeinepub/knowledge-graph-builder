# Specification

## Summary
**Goal:** Rename two mode selector button labels to English and add vertical scrolling to the bottom data panel.

**Planned changes:**
- In `ModeSelector.tsx`, rename the "Глобальный" button label to "Global" and "По намерениям" to "Intent", with fixed equal widths on both buttons to prevent layout shifts
- In `App.tsx`, add a defined `max-height` and `overflow-y: auto` to the bottom panel container (Triplets, Taxonomy, Ontology tabs) so all tab content is fully scrollable

**User-visible outcome:** Mode buttons display English labels without causing sidebar layout shifts, and the bottom data panel is fully scrollable so users can see all triplets, taxonomy, and ontology entries without content being clipped.
