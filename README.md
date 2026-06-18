# PROSPECT

**Predictive Reporting Of Scenarios & Planned Execution for Commercial Trends**

A browser-based commercial forecasting tool built in React. PROSPECT allows analysts to upload subscriber/revenue data, generate multi-model IBRO (Inflow / Base / Retention / Outflow) forecasts, layer market events and pricing scenarios on top, and compare forecasts against actuals — all without a back-end server.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project File Structure](#project-file-structure)
3. [Source Code — Detailed Breakdown](#source-code--detailed-breakdown)
4. [Cloud Run Deployment Guide](#cloud-run-deployment-guide)
5. [Running Locally (Development)](#running-locally-development)
6. [Archive Folder](#archive-folder)

---

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| React | 19 | UI framework |
| TypeScript | 5.8 | Type safety across the codebase |
| Vite | 6 | Build tool and dev server |
| Tailwind CSS | 4 | Utility-first styling |
| Recharts | 3 | Chart rendering (line charts, reference lines) |
| date-fns | 4 | Date parsing and formatting |
| SheetJS (xlsx) | 0.18 | Excel file import and export |
| Lucide React | — | Icon library |
| Nginx (Alpine) | 1.27 | Production static file server (Docker only) |

---

## Project File Structure

```
prospect/
│
├── Dockerfile              # Multi-stage Docker build (Node build → Nginx serve)
├── nginx.conf              # Nginx server config template; $PORT substituted at runtime
├── .dockerignore           # Excludes node_modules, dist, .git etc. from Docker context
├── .gitignore              # Standard Git ignore rules
├── .env.example            # Template showing required environment variables
│
├── index.html              # Single HTML entry point — Vite injects the compiled bundle here
├── vite.config.ts          # Vite build config (React plugin, Tailwind, path aliases, env vars)
├── tsconfig.json           # TypeScript compiler options
├── package.json            # NPM dependencies and build scripts
├── package-lock.json       # Locked dependency tree (use `npm ci` to install)
│
├── public/
│   └── logo.png            # PROSPECT logo served as a static asset
│
├── src/                    # All application source code (see detailed breakdown below)
│
└── _archive/               # Superseded Streamlit/Python app — kept for reference only
                            # Not used by the React app or the Docker build
```

---

## Source Code — Detailed Breakdown

```
src/
├── main.tsx                        # React entry point — mounts <App /> into index.html
├── index.css                       # Global CSS (Tailwind base imports)
├── App.tsx                         # Root component — owns all application state, the
│                                   # session export/import logic, and tab routing
│
├── context/
│   └── ForecastContext.tsx         # React Context that shares forecast state (baseForecast,
│                                   # forecastStore, adjustedForecast, bulkRuns) across tabs
│                                   # without prop-drilling through every component
│
├── types/
│   └── forecast.ts                 # TypeScript interfaces for every data shape in the app:
│                                   # BaseForecast, BaseForecastMonth, ForecastBand,
│                                   # MarketEvent, YieldEvent, PricingEvent,
│                                   # ActualsComparison, ComparisonMonth, AccuracySummary etc.
│
├── utils/
│   ├── forecasting.ts              # Core forecasting engine:
│   │                               #  • Holt Linear, Damped Trend, and Holt-Winters models
│   │                               #  • Per-series MSE grid-search parameter optimisation
│   │                               #  • MarketEvent interface and event application logic
│   │                               #  • Cohort data aggregation helpers
│   │
│   └── varianceEngine.ts           # Actuals vs forecast comparison engine:
│                                   #  • Computes absolute and percentage variance per month
│                                   #  • Calculates MAPE across all cohorts
│                                   #  • Flags whether actuals fall within confidence bands
│
├── workers/
│   └── forecasting.worker.ts       # Web Worker — runs computationally intensive forecast
│                                   # calculations off the main UI thread to prevent the
│                                   # browser from freezing during bulk cohort generation
│
└── components/
    │
    ├── ── Navigation & Layout
    │   ├── StepIndicator.tsx       # Top navigation bar showing the 5 workflow steps
    │   └── ViewFilterBar.tsx       # Segment / Product L1+L2 / Channel L1+L2 filter bar
    │                               # shared across multiple tabs
    │
    ├── ── Tabs (one per workflow step)
    │   ├── HomeTab.tsx             # Step 1 — file upload, Import Save, step-unlock status
    │   │
    │   ├── StandardForecastTab.tsx # Step 2 — column mapping and single-cohort forecast
    │   │                           # generation with model selection and confidence band
    │   │                           # parameter controls
    │   │
    │   ├── WhatIfTab.tsx           # Step 3 — scenario modelling:
    │   │                           #  • Volume card: subscriber market events with optional
    │   │                           #    spread across multiple months
    │   │                           #  • Value card: tariff mix (yield) events with dynamic
    │   │                           #    L2 tier sliders seeded from the uploaded data
    │   │                           #  • Pricing card: ARPU delta events (% or absolute)
    │   │                           #    targeting inflow, retention, or full base cohorts
    │   │                           #  • Multi-pass ARPU blending engine
    │   │                           #  • Interactive Recharts line chart with event markers
    │   │
    │   ├── OverallForecastTab.tsx  # Step 4 — aggregated view across all generated cohorts;
    │   │                           # revenue and volume summary charts
    │   │
    │   └── ForecastVsActualsTab.tsx # Step 5 — actuals import and comparison:
    │                                #  • Forecast vs Actuals chart with confidence bands
    │                                #  • Historical Accuracy by Cohort MAPE table
    │                                #  • AutoML Challenger Analysis sub-tab
    │                                #  • Export Session button (full save-point to Excel)
    │
    ├── ── Modals & Drawers
    │   ├── GenerateCohortForecastModal.tsx  # Dialog for generating a single cohort forecast
    │   ├── ViewCohortForecastModal.tsx      # Read-only view of a previously generated forecast
    │   ├── BulkGenerateModal.tsx            # Bulk generation across all cohort combinations
    │   ├── ManageBulkDrawer.tsx             # Side drawer listing bulk run history
    │   ├── ImportActualsModal.tsx           # Month-selector shown when importing actuals
    │   ├── DataMappingDrawer.tsx            # Column mapping drawer for uploaded file headers
    │   └── RemoveActualsModal.tsx           # Confirmation dialog for clearing actuals
    │
    └── ── Shared / Utility Components
        ├── ChallengerModels.tsx    # AutoML challenger model panel — runs alternative forecast
        │                           # models and surfaces accuracy comparisons
        ├── CohortDimCheckboxes.tsx # Checkbox group for cohort dimension selection
        ├── ForecastSummaryBar.tsx  # KPI strip showing total forecast volume and revenue
        └── HierarchicalDropdown.tsx # Two-level L1 → L2 product/channel selector
```

---

## Cloud Run Deployment Guide

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- [Google Cloud SDK (`gcloud`)](https://cloud.google.com/sdk/docs/install) installed and authenticated
- A Google Cloud project with the following APIs enabled:
  - Cloud Run API
  - Artifact Registry API
- Permissions: `roles/run.admin` and `roles/artifactregistry.writer` (or equivalent)

---

### Step 1 — Authenticate with Google Cloud

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

---

### Step 2 — Configure Docker to push to Artifact Registry

```bash
gcloud auth configure-docker REGION-docker.pkg.dev
```

Replace `REGION` with your chosen region, e.g. `europe-west2`.

---

### Step 3 — Create an Artifact Registry repository (first time only)

```bash
gcloud artifacts repositories create prospect \
  --repository-format=docker \
  --location=REGION \
  --description="PROSPECT React app"
```

---

### Step 4 — Build the Docker image

From the project root (where `Dockerfile` lives):

```bash
docker build -t REGION-docker.pkg.dev/YOUR_PROJECT_ID/prospect/app:v4.3 .
```

The build has two stages and requires no manual intervention:
- **Stage 1 (node:20-alpine)** — installs NPM dependencies via `npm ci` and runs `vite build`
- **Stage 2 (nginx:1.27-alpine)** — copies the compiled static files into a lightweight Nginx image (approx. 25 MB final image size)

---

### Step 5 — Push the image

```bash
docker push REGION-docker.pkg.dev/YOUR_PROJECT_ID/prospect/app:v4.3
```

---

### Step 6 — Deploy to Cloud Run

```bash
gcloud run deploy prospect \
  --image REGION-docker.pkg.dev/YOUR_PROJECT_ID/prospect/app:v4.3 \
  --platform managed \
  --region REGION \
  --allow-unauthenticated \
  --port 8080
```

**Flag notes:**
- `--allow-unauthenticated` — makes the app publicly accessible. Remove this flag if access should be restricted to internal users and add IAP or Identity-Aware Proxy instead.
- `--port 8080` — Cloud Run injects `$PORT=8080` at runtime; the `nginx.conf` template reads this variable automatically via `envsubst`.

---

### Step 7 — Verify the deployment

Cloud Run prints a service URL on success:

```
Service URL: https://prospect-xxxxxxxxxx-nw.a.run.app
```

Open the URL in a browser to confirm the app loads correctly.

---

### Updating the Application

To deploy a new version, repeat Steps 4–6 with an incremented image tag (e.g. `:v4.4`). Cloud Run performs a zero-downtime rollout automatically.

---

## Running Locally (Development)

```bash
# Install dependencies
npm ci

# Start the dev server at http://localhost:3000
npm run dev

# Type-check without building
npm run lint

# Build for production (output written to dist/)
npm run build
```

---

## Archive Folder

The `_archive/` directory contains the original Streamlit/Python prototype that preceded this React application. **It is not used by the React app or the Docker build** and can be safely ignored by the DevOps team. It is retained for historical reference only.

```
_archive/
├── app.py                          # Original Streamlit application
├── run_app.py                      # Subprocess launcher for Streamlit
├── requirements.txt                # Python dependencies
├── metadata.json                   # Google AI Studio project descriptor
└── src/components/
    └── PythonIntegrationTab.tsx    # Orphaned React component that documented the Python app
```
