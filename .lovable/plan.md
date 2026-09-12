# Sepsis Triage ICU dashboard

## What I’ll build
- Replace the empty home page with a functional dark ICU early-warning dashboard.
- Add a grouped patient selector for developed-sepsis and no-sepsis cohorts.
- Load each selected patient’s vitals and triage results from the configured FastAPI URL.
- Fall back automatically to realistic built-in patient data when the API is unavailable, keeping the preview fully usable.
- Present the alert tier as a restrained colored status stripe, plus digital vital readouts, qSOFA/SIRS/risk scores, clinical reasoning, and recommended action.
- Plot HR, respiration, temperature, and systolic pressure over ICU hours in a clear multi-series chart.
- Add a compact API URL setting with connection status and refresh controls.
- Ensure polished desktop and mobile layouts, accessible states, and app-specific page metadata.

## Technical details
- Use the existing TanStack Start page and semantic Tailwind theme tokens.
- Use browser-side requests so the dashboard can connect directly to the configured FastAPI service.
- Store the API URL preference in browser storage after hydration; no database is needed.
- Use Recharts if already available; otherwise add it as the charting dependency.
- Validate loading, fallback, selection, settings, and responsive rendering in the live preview.
