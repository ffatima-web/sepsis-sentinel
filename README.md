# Sepsis Sentinel

Build the "Sepsis Triage" clinical ICU early-warning dashboard. It connects to the FastAPI backend (GET /patients, GET /patient/{patient_id}/vitals, GET /patient/{patient_id}/triage) with a configurable API URL setting and realistic mock fallback data so the preview is fully functional out of the box. Implement the grouped patient dropdown ('Developed sepsis' vs 'No sepsis'), high-precision digital ICU monitor vitals readout panel with monospace values, alert tier indicators (URGENT red, ELEVATED amber, ROUTINE teal) styled as colored left-border stripes, AI clinical reasoning and recommendations panel, and time-series vitals line chart over ICU hours following the specified dark theme palette (#0B1220 background, #131B2E cards, #E5E9F0 text, #6B7688 muted).

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a72a47ef-cc59-43b7-a88b-f281d6642dab).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
