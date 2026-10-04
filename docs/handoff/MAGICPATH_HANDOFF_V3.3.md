# MagicPath UI Handoff V3.3

## Purpose

This document connects the frozen Life OS design system to the implementation-facing MagicPath product canvas.

MagicPath is a composition and flow reference. It does not supersede Storybook, System Design, or the Implementation Specification.

## Project

- Name: Life OS — App UI V3.3
- Project ID: `457438444340269056`
- Project URL: https://www.magicpath.ai/files/457438444340269056

## Artifact index

| Artifact | Component ID | Generated name | Role |
| --- | --- | --- | --- |
| Life OS — Child App V3.3 | `457440621448282112` | `keen-gulf-5924` | Interactive child shell: Today, Journey, Goals, Money, Jobs, Family |
| Life OS — Parent Control Room V3.3 | `457441021815582720` | `sweet-lake-1463` | Parent shell: Home, Children, Insights, Family, Review, Settings |
| Life OS — Setup & Critical Flows V3.3 | `457441396597616640` | `daring-moon-4846` | Profile switching, onboarding, money allocation, job review, graduation |
| Life OS — UI Contract Board V3.3 | `457441795689824256` | `fiercely-brook-3416` | Foundations, iconography, semantic boundaries, source-of-truth hierarchy |
| Life OS — Product State Matrix V3.3 | `457443072415010816` | `steadily-river-4848` | Responsibility, money, job, goal, insight, sync/conflict/correction states |
| Life OS — Responsive RTL Motion Matrix V3.3 | `457446089084268544` | `radiant-land-7390` | 390/768/1024/1440, Arabic RTL, age density, reduced/off motion |

## Implementation interpretation

### MagicPath may be used to infer

- relative screen hierarchy
- content grouping
- primary vs secondary emphasis
- navigation intent
- critical flow order
- child vs parent density
- which semantic states must exist

### MagicPath must not be used to infer

- business rules
- authorization logic
- ledger mutation rules
- XP calculations
- graduation eligibility
- autonomy thresholds
- offline conflict semantics beyond the documented labels
- exact production Island artwork when Storybook provides authored assets

## Exact visual source

Use `@life-os/design-system` for production UI.

The MagicPath artifacts intentionally use simplified local composition primitives in places so that flows remain inspectable. Their purpose is not to replace the package.

In particular:

- use the frozen `IslandRenderer`, not prototype Island geometry
- use the frozen `ResponsibilityCard`, not prototype task rows
- use the frozen `MoneyAllocation`, not prototype sliders
- use the frozen Job and Graduation patterns
- use the frozen icon wrapper and Lucide sizing rules
- preserve Storybook RTL and reduced-motion behavior

## Responsive rules

Reference widths:

- 390 × 844
- 768 × 1024
- 1024 × 900
- 1440 × 1000

Layouts are fluid between these checkpoints.

World labels may reposition and scale to avoid collisions, but readability takes priority over preserving exact illustration coordinates.

## Arabic / RTL

- use logical CSS properties
- mirror directional icons only when semantically appropriate
- do not mirror Visual World geometry
- Arabic typography uses larger sizes and approximately 1.6 body line-height
- English and Arabic must carry equivalent information and actions

## Motion

- Full: subtle environmental motion and milestone sequences
- Reduced: remove large transforms, parallax, and repeated ambience
- Off: no nonessential motion; final state appears immediately
- all motion levels preserve identical state meaning

## Agent workflow

1. Read System Design semantic invariants.
2. Read Implementation Specification architecture/data rules.
3. Inspect Storybook for exact approved component/state visuals.
4. Inspect MagicPath for product composition and flow.
5. Implement the smallest vertical slice using the design-system package.
6. Do not rebuild screens from screenshots.
7. Do not introduce new product semantics without an explicit product decision.

## First app slice

The implementation still begins with **Make Bed responsibility** using:

- child Today composition
- ResponsibilityCard
- offline pending completion state
- canonical server acceptance after sync
- no money implication
- no negative XP
