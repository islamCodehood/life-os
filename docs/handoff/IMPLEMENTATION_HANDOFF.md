# Design System → Life OS Application Handoff

## Rule for implementation agents

Storybook is the coded visual contract. System Design / Architecture / Implementation Specification are the behavioral contract. MagicPath is the approved product-composition and flow reference.

When these disagree:

1. frozen System Design wins on behavior
2. Implementation Specification wins on architecture / data flow
3. Storybook wins on approved component rendering, visual states, responsive behavior, RTL, and motion
4. MagicPath clarifies how approved pieces compose into product screens and critical flows

Do not infer new business rules from a screenshot or MagicPath prototype.

## Application consumption

Example imports:

    import {
      Button,
      ChildAvatar,
      ResponsibilityCard,
      JobCard,
      MoneyAllocation,
      ChildScreenTemplate,
      IslandRenderer,
    } from '@life-os/design-system';
    import '@life-os/design-system/styles.css';

The app supplies data, commands and semantic state. The design system supplies presentation.

## MagicPath visual handoff

Project:

- Life OS — App UI V3.3
- Project ID: `457438444340269056`
- URL: https://www.magicpath.ai/files/457438444340269056

Primary artifacts:

- Child App V3.3 — component `457440621448282112`, generated name `keen-gulf-5924`
- Parent Control Room V3.3 — component `457441021815582720`, generated name `sweet-lake-1463`
- Setup & Critical Flows V3.3 — component `457441396597616640`, generated name `daring-moon-4846`
- UI Contract Board V3.3 — component `457441795689824256`, generated name `fiercely-brook-3416`
- Product State Matrix V3.3 — component `457443072415010816`, generated name `steadily-river-4848`
- Responsive RTL Motion Matrix V3.3 — component `457446089084268544`, generated name `radiant-land-7390`

MagicPath is not a replacement for the design-system package. Do not copy its local color constants, simplified illustrative world geometry, or prototype-only helper components into application code when the equivalent frozen Storybook/design-system component exists.

Use MagicPath to understand:

- screen hierarchy
- navigation intent
- product composition
- critical-flow ordering
- parent-vs-child density
- semantic state coverage
- responsive checkpoints
- RTL direction expectations
- reduced-motion information parity

Use Storybook/design-system code for the actual components and visual implementation.

## What application code must not duplicate

- component CSS
- money bucket ordering
- responsibility visual states
- graduation presentation
- job visual state language
- Island theme art
- region stage artwork
- motion sequences
- child/parent screen shell behavior
- RTL presentation rules

## What application code must own

- authorization
- family ownership checks
- commands and idempotency
- offline outbox
- canonical server state
- job state transitions
- money ledger
- activity opportunity resolution
- XP ledger
- goal revisions
- graduation readiness evidence
- autonomy decisions
- semantic WorldSceneState projection

## First implementation vertical slice

The first app slice remains:

Make Bed responsibility.

Use the approved Today screen + ResponsibilityCard + offline completion states. Do not begin by rebuilding the whole screen catalog.
