# OODA Logic and Calculation Reference

This document specifies the exact calculations, decision rules, and I/O schemas used by Ona Terminal across OODA stages: diagnose, schedule, BOM, and order. It is a normative reference for clients and demos.

Scope and terminology
- EAR: Energy At Risk (USD/day). A monetized rate for expected energy loss if the asset remains degraded or down.
- Catalogue: Parts/components dataset used to populate BOM items. Fields: `sku`, `oem`, `model`, `price_usd`, `lead_time_days`, etc.
- Asset: Installed equipment metadata with nested `components` (oem/model/serial/type).

1) Diagnose
- Purpose: identify failed/degraded component(s) on an asset.
- Inputs:
  - asset: Asset JSON (see assets-schema.md).
  - telemetry/observations: free-form notes or structured signals (not yet standardized here).
- Outputs:
  - findings: list of components with fields `{oem, model, serial?, type, severity, notes}`.
  - recommended_actions: list of action codes (e.g., `replace_component`, `inspect`, `clean_filters`).
- Selection/logic (current demo): user- or LLM-determined; no hard-coded scoring in CLI.

<!-- DOCS_EXAMPLE: diagnose run -->

2) Schedule
- Purpose: create a work item (maintenance/repair) to address a finding.
- Inputs:
  - finding/component descriptor: `{oem, model, serial?, type}` from Diagnose.
  - target window and constraints (free-form for the demo).
- Outputs:
  - schedule object: `{id, asset_id, component: {oem, model, serial?, type}, window, notes}`.
- Logic: basic validation and persistence only.

<!-- DOCS_EXAMPLE: schedule create -->

3) BOM Build (with EAR-based SKU selection)
- Purpose: build a Bill of Materials for the scheduled work.
- Inputs:
  - schedule_id and/or explicit `--asset`.
  - catalogue (from `~/.asoba/ooda/catalog/components.json`).
  - options:
    - `--from-catalog`: fetch compatible SKUs for the component.
    - `--variants-per-type N`: keep top N alternatives for demo comparisons.
    - `--parts JSON`: explicitly add SKUs (bypasses selection).
    - `--ear-usd-day X`: EAR value in USD/day to drive automatic selection.
- Outputs (BOM JSON):
  ```json
  {
    "bom_id": "<string>",
    "asset_id": "<string>",
    "items": [
      {
        "sku": "<string>",
        "oem": "<string>",
        "model": "<string>",
        "description": "<string>",
        "uom": "each",
        "qty": 1,
        "price_usd": 120.0,
        "lead_time_days": 7,
        "type": "<component_type>",
        "recommended": true,
        "selection_metrics": {
          "ear_usd_day": 120.0,
          "total_cost_ear": 960.0,
          "rank": 1
        }
      }
    ]
  }
  ```
- Selection logic (when `--ear-usd-day` is set and `--from-catalog` used):
  - Candidate set: catalogue parts where `{oem, model}` match the diagnosed component (and optional `type`/attributes if provided).
  - Scoring: `total_cost_ear = price_usd + (ear_usd_day * lead_time_days)`.
  - Ranking: ascending by `total_cost_ear`. Ties break by lower `lead_time_days`, then lower `price_usd`.
  - `recommended = true` is applied to the top-ranked SKU per component type.
  - `--variants-per-type N` keeps top-N; otherwise we can keep only the recommended item.
  - Missing metrics: if `price_usd` or `lead_time_days` is missing, candidate is demoted to the end; policy may be adjusted.

<!-- DOCS_EXAMPLE: bom build -->

4) Order Create (validation and submission)
- Purpose: validate the BOM against the asset and "submit" the order.
- Inputs:
  - `--bom_id`, `--asset`.
  - BOM JSON (from step 3).
- Validation:
  - For any BOM item specifying `oem/model/serial`, ensure it matches an installed component on the asset. If no such fields exist, treated as consumables and allowed.
- Submission:
  - The CLI currently orders exactly what is in the BOM (no re-selection). If multiple variants exist, whatever is present will be included; recommended flags are informational.

<!-- DOCS_EXAMPLE: order create -->

Schemas (summary)
- Asset schema: see `assets-schema.md`.
- Catalogue schema: see `catalog.md`.
- BOM schema: see `bom-schema.md` (this doc defines structure expanded above).

Notes and extensibility
- Clients may substitute alternative selection strategies (min price, min lead time, weighted multi-criteria). The BOM selection stage is the recommended point of customization to keep ordering simple and auditable.
- Future: incorporate stock/availability, vendor preferences, warranty constraints, and attribute-level compatibility filters (voltage class, thermal rating, etc.).