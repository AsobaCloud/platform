# OODA Reference (Logic, Policies, and Schemas)

Single-source reference for Ona Terminal OODA stages: logic, inputs, outputs, and schemas. Use this as the canonical spec for demos and client reviews.

Terminology
- EAR: Energy At Risk (USD/day). Monetized rate of expected energy loss while an asset remains degraded or down.
- Asset: Installed equipment metadata with nested components.
- Catalogue: Parts/components dataset used to populate BOMs.

0) Observe
- Purpose: collect and evaluate raw observations to detect anomalies or degradation events that may warrant action.
- Commands
  - `ona-terminal detect run --asset <ID> [--window_min N] [--severity_threshold X]`
  - `ona-terminal detect list`
- Inputs
  - Observations CSV (example path: `~/.asoba/ooda/inputs/observations/inverter_data.csv`)
    - Schema (columns): `timestamp, asset_id, temperature_c, voltage_v, power_kw`
  - Optional forecast CSV per asset (example path: `~/.asoba/ooda/inputs/forecasts/<ASSET>_forecast.csv`)
    - Schema (columns): `timestamp, predicted_power_kw`
- Output
  - Detections record (conceptual JSON)
    ```json
    {
      "asset_id": "INV-001",
      "window": {"start": "...", "end": "..."},
      "signals": {"temperature_c": 53.8, "power_kw": 12.8},
      "forecast": {"predicted_power_kw": 15.5},
      "deviation": {"power_delta_kw": -2.7},
      "severity": 0.82,
      "notes": "Observed power below forecast; high temperature"
    }
    ```
- Logic (demo)
  - Computes simple deviations between observed power and forecast (if available).
  - Aggregates recent window metrics and scores a `severity` in [0,1].
  - Feeds into Orient (Diagnose) to identify likely component(s).

1) Assets
- Purpose: manage asset metadata for downstream validation and selection.
- Command group: `ona-terminal assets`
- Inputs
  - Add: `--id --name --type --capacity-kw --location --components-json`
  - Components JSON: `[{"oem":"Sungrow","model":"SG20KTL","serial":"SN123"}]`
- Output
  - `~/.asoba/ooda/inputs/assets.json`
- Schema (excerpt)
```json
{
  "assets": [
    {
      "id": "INV-001",
      "name": "Inverter 001",
      "type": "Solar Inverter",
      "capacity_kw": 20.0,
      "location": "Solar Farm A",
      "components": [
        { "oem": "Sungrow", "model": "SG20KTL", "serial": "SN123456", "type": "inverter" }
      ]
    }
  ]
}
```

2) Diagnose (Orient)
- Purpose: identify failed/degraded component(s).
- Inputs: asset record; observations/telemetry (format flexible for demo).
- Output
```json
{
  "findings": [
    { "oem": "Sungrow", "model": "SG20KTL", "serial": "SN123456", "type": "fan", "severity": 0.8, "notes": "High temp; fan stall" }
  ],
  "recommended_actions": ["replace_component"]
}
```
- Logic: user/LLM-driven; CLI performs validation only.

3) Schedule
- Purpose: create a work item to act on a finding.
- Inputs: finding descriptor `{oem, model, serial?, type}`, time window, notes.
- Output
```json
{ "id": "SCH-1001", "asset_id": "INV-001", "component": {"oem":"Sungrow","model":"SG20KTL","type":"fan"}, "window": {"start":"...","end":"..."} }
```

4) BOM Build (Decide)
- Purpose: produce the Bill of Materials for the scheduled work.
- Command: `ona-terminal bom build` with options:
  - `--asset`, `--schedule_id`, `--from-catalog`, `--variants-per-type N`, `--parts JSON`, `--ear-usd-day X` (optional, for selection).
- Candidate filter: compatible catalogue SKUs by OEM/model (and optional type/attributes).
- EAR-based selection (if `--ear-usd-day` provided):
  - Score: `total_cost_ear = price_usd + (ear_usd_day * lead_time_days)`
  - Rank ascending; ties: lower `lead_time_days`, then lower `price_usd`.
  - Mark top-ranked SKU per type `recommended: true`.
  - Keep top-N if `--variants-per-type N`; otherwise keep only recommended.
- BOM schema
```json
{
  "bom_id": "SCH-1001",
  "asset_id": "INV-001",
  "items": [
    {
      "sku": "SG20KTL-FAN-STD",
      "oem": "Sungrow",
      "model": "SG20KTL",
      "description": "Cooling fan",
      "uom": "each",
      "qty": 1,
      "price_usd": 120.0,
      "lead_time_days": 7,
      "type": "fan",
      "recommended": true,
      "selection_metrics": { "ear_usd_day": 120.0, "total_cost_ear": 960.0, "rank": 1 }
    }
  ]
}
```

BOM field notes
- `sku`: catalogue identifier; optional for consumables but recommended.
- `oem`/`model`/`serial`: if present, used for asset compatibility validation during order.
- `qty`: numeric; defaults to 1 when derived from catalogue `default_qty`.
- `price_usd`, `lead_time_days`: used by EAR-based selection scoring.
- `type`: component type (e.g., fan, igbts, fuse); optional but useful for grouping/variants.
- `recommended`: boolean; set for top-ranked SKU per type when selection is performed.
- `selection_metrics`: included when selection is computed; contains `ear_usd_day`, `total_cost_ear`, and `rank`.

5) Order (Act)
- Purpose: validate and submit the order based on the BOM.
- Command: `ona-terminal order create --bom_id ... --asset ...`
- Validation: for items with component identity (`oem/model/serial`), must match an installed asset component. Items without these fields are treated as consumables and skipped from compatibility checks.
- Selection: orders exactly what is in the BOM; no re-selection at this stage.
- Output (example)
```json
{ "order_id": "ORD-2001", "bom_id": "SCH-1001", "asset_id": "INV-001", "status": "submitted" }
```

6) Catalogue
- Location: `~/.asoba/ooda/catalog/components.json`
- Schema (excerpt)
```json
{
  "parts": [
    {
      "sku": "SG20KTL-FAN-STD",
      "oem": "Sungrow",
      "model": "SG20KTL",
      "description": "DC cooling fan, standard",
      "uom": "each",
      "default_qty": 1,
      "price_usd": 95.0,
      "lead_time_days": 10,
      "compatible_assets": ["SG20-series"],
      "attributes": {"voltage":"24VDC","cfm":120}
    }
  ]
}
```

Policies and extensibility
- Alternative strategies (min price, min lead time, weighted multi-criteria) can replace EAR-based selection at BOM stage.
- Future: add stock/availability, vendor preferences, warranty rules, and richer attribute compatibility.
