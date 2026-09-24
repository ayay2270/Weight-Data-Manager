# Weight Data Manager

Browser-based weight data collection and review tool for Part / Node / Rack / Package measurements. Teams enter measurements, submit them for engineer review, and keep data locally in the browser (JSON + LocalStorage). No backend server is required for V1.

**Live app:** https://ayay2270.github.io/Weight-Data-Manager/

## Purpose

Replace scattered Excel weight logs with a focused web app that:

- Accepts g or kg inputs and stores every record as canonical `weight_kg`
- Supports Tester submission for engineer review
- Supports Engineer review (Verified / Need Recheck / Rejected)
- Provides project management, search / filter / sorting, saved views, and record detail drawer
- Exports Excel and CSV, imports Excel via the official template, plus JSON backup from Settings

## Users

- Testers collecting and updating measurement data
- Engineers reviewing Pending Review and Need Recheck queues
- Project leads tracking record status by project

## Typical workflow

1. Open the Web App (or run locally).
2. Review **Dashboard** attention items and recent records.
3. Manage projects in **Projects**.
4. Enter measurements in **Weight Data**, then **Submit for Review** or **Submit & Add Next**.
5. Engineers open **Review** on Pending Review rows → Verify / Need Recheck / Reject.
6. Need Recheck rows return to the Tester for edits, then **Resubmit for Review**.
7. Use **Import / Export** for Excel import (official template) or Excel/CSV export; use **Settings** for JSON backup or demo reset.

## Core features

- Project management (Active / Archived, project notes)
- Weight Data management (Add / Edit / Duplicate / Delete draft records)
- Tester measurement entry (**Submit for Review**, **Submit & Add Next**)
- Engineer Review Modal (Verify, Need Recheck, Reject)
- Possible duplicate warning on new record submission
- Search, filters, sorting, column visibility, saved views
- Resizable Description column in Weight Data table
- Record Detail Drawer for full record view
- Export to Excel / CSV (all / filtered / project / selected scopes)
- Import Excel using the generated `Weight_Data_Import_Template.xlsx` (Draft or Submit for Review)
- Settings: JSON backup / restore, reset demo data

## Add Record flow

When adding a new weight record:

- **Submit for Review** — validates required fields, saves as `Pending Review`, closes the modal
- **Submit & Add Next** — same validation and status, keeps the modal open and retains project / phase / level / source / measured-by / measured-date for the next entry

Duplicate opens the Add Record form with fields prefilled from the source record. The user must submit before a new record is created.

## Stack

- React 19 + TypeScript + Vite
- React Router
- Recharts
- SheetJS (`xlsx`) for Excel/CSV export
- LocalStorage persistence (no auth, no server)

## Repository structure

```text
src/
  components/   Sidebar, modals, record form, review modal, record detail drawer
  pages/        Dashboard, Projects, Weight Data, Import/Export, Settings
  data/         types + seed.json
  hooks/        LocalStorage data provider
  utils/        helpers, Excel/CSV export, storage
public/         Static assets
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

```bash
npm test
npm run lint
```

## Deployment (GitHub Pages)

- Source branch: `gh-pages` (built `dist/` with base `/Weight-Data-Manager/`)
- After local `npm run build`, publish with:

```bash
npm run build
npx --yes gh-pages -d dist -b gh-pages
```

- The sidebar shows the build commit hash baked in at build time (`__APP_GIT_COMMIT__`).

## URLs

- **Web App:** https://ayay2270.github.io/Weight-Data-Manager/
- **GitHub:** https://github.com/ayay2270/Weight-Data-Manager

## Data notes

- Record tables display canonical kilograms to three decimal places; the original numeric input and unit remain available when editing.
- Source values: Internal Measurement, Supplier, Specification, Estimated, Unknown
- Status values: Draft, Pending Review, Verified, Rejected, Need Recheck
- Review-only fields (`reviewedBy`, `reviewedDate`, `reviewComment`) are updated only through the Review Modal
- Record fields also include Build / Phase, Configuration, Measured By, Supplier, Reference
- Older LocalStorage statuses (Measured / Estimated / Missing) are migrated on read
- Older saved projects may still contain unused legacy fields such as `expectedItems` or a project description. They are ignored on load and are not shown or required in the UI
- Legacy `Draft` records may still exist in older LocalStorage data and remain editable, but new records are submitted directly for review
- UI language: Traditional Chinese / English only (no Simplified Chinese chrome or README)

## License / scope

V1 intentionally excludes login, shared server databases, Windows EXE packaging, and firewall tooling. Data lives in the user’s browser until exported.
