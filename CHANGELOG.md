# Changelog

## 2.0.0

A rewrite of most of the app.

- Split the single `App.tsx` into pages, components and small stores; added Overview, Bulk import and Catalog pages, an edit panel, light/dark themes and a mobile layout.
- API URL comes from `VITE_API_URL` instead of being hardcoded; Vite proxies `/api` in development.
- Backend reorganised into an app package with an app factory, settings from the environment and routers under `/api`.
- Gemini calls use a JSON schema and the async client, with retries and readable errors for quota, key and timeout problems. The server no longer refuses to start without a key: it falls back to demo mode.
- Product photos are stored (WebP, full size and thumbnail) and shown in the catalog.
- Products gained title, tags, details, price, stock, SKU, status, launch copy and timestamps. Old databases migrate in place.
- Bulk import moved to a client-side queue with per-photo progress and retry. Failed photos are no longer saved as products with an "Error" category.
- New: edit, delete, bulk publish/archive/delete, CSV export, launch copy in four tones, "needs attention" list.
- Added pytest suite, ruff, Prettier and a GitHub Actions workflow.

## 1.0.0

- Upload a product photo, get a category and description from Gemini, publish it to a SQLite catalog.
- Instagram caption and meta description generator.
- Bulk upload in a single request.
