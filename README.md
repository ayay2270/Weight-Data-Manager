# Weight Data Manager

Browser-based engineering weight database for Part / Node / Rack / Package measurements. Teams track collection progress per project, import Excel/CSV workbooks, and keep data locally in the browser (JSON + LocalStorage). No backend server is required for V1.

## Purpose

Replace scattered Excel weight logs with a shared-style web app that:

- Accepts g or kg inputs and stores every record as canonical `weight_kg`
- Shows project collection progress and completeness (Collected ÷ Expected)
- Supports add / edit / delete / duplicate workflows
- Imports the existing Weight Measurement Record X01 workbook
- Exports Excel, CSV, and JSON backups

## Users

- Mechanical / packaging / system engineers collecting weights
- Project leads reviewing completeness by Part / Node / Rack / Package
- Anyone who previously maintained `Weight Measurement Record_X01.xlsx`

## Typical workflow

1. Open the Web App (or run locally).
2. Review **Dashboard** progress bars and recent records.
3. Open **Projects** to set expected item counts (completeness targets).
4. Enter or edit rows in **Weight Data**.
5. Use **Import / Export** for Excel/CSV hand-off.
6. Use **Settings** for defaults, JSON backup, or reset demo data.

## Stack

- React 19 + TypeScript + Vite
- React Router
- Recharts
- SheetJS (`xlsx`) for Excel/CSV
- LocalStorage persistence (no auth, no server)

Future Supabase / SharePoint hooks can attach to the same Project / WeightRecord model without changing V1 UI contracts.

## Repository structure

```text
src/
  components/   Sidebar, modal, progress, record form
  pages/        Dashboard, Projects, Weight Data, Import/Export, Settings
  data/         types + seed.json (normalized from X01)
  hooks/        LocalStorage data provider
  utils/        completeness helpers, Excel/CSV IO, storage
public/sample/  Sample X01 workbook for import testing
data/           Original Excel source file
```

## Local development

```bash
npm install
npm run dev
```

Dev server: [http://127.0.0.1:43122/Weight-Data-Manager/](http://127.0.0.1:43122/Weight-Data-Manager/)

```bash
npm run build
npm run preview
```

Preview server: [http://127.0.0.1:43123/Weight-Data-Manager/](http://127.0.0.1:43123/Weight-Data-Manager/)

## Deployment (GitHub Pages)

- Source branch: `gh-pages` (built `dist/` with base `/Weight-Data-Manager/`)
- After local `npm run build`, publish with:

```bash
npm run build
npx --yes gh-pages -d dist -b gh-pages
```

- Or push the contents of `dist/` to the `gh-pages` branch manually.

## URLs

- **Web App:** https://ayay2270.github.io/Weight-Data-Manager/
- **GitHub:** https://github.com/ayay2270/Weight-Data-Manager

## Data notes

- Record tables display canonical kilograms to three decimal places; the original numeric input and unit remain available when editing.
- Completeness = records with status Measured or Verified (and a weight) ÷ project `expectedItems`
- Expected counts are editable per project in the Projects UI — not hardcoded in dashboard widgets
- Source values: Internal Measurement, Supplier, Specification, Estimated, Unknown
- Status values: Draft, Measured, Verified, Estimated, Missing
- UI language: Traditional Chinese / English only (no Simplified Chinese chrome or README)

## License / scope

V1 intentionally excludes login, shared server databases, Windows EXE packaging, and firewall tooling. Data lives in the user’s browser until exported.
