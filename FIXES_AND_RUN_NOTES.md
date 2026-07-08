# JPK IMS v22 - Google Sheet inventory import correction

## Fixed in v22

This version fixes the Google Sheets inventory import issue for the existing JPK Store sheet format.

### Inventory Google Sheet heading support

The importer now understands your real headings, including:

- `Code`
- `SKU CODE`
- `FOUNDRY`
- `DEPTARTMENT` typo from the old sheet
- `Item Name`
- `HSN CODE`
- `GST%`
- `Daily Avg Consumption (Low / Normal / Peak)`
- `Current Season`
- `Lead Time`
- `Safety Factor`
- `Max Level`
- `Opening Stock Quantity`
- `Total Available Quantity`
- `AVAILABLE QTY`
- `UOM`
- `SECONDARY UOM`
- `FORMULA FOR CALCULATING SECONDARY UOM TO PRIMARY UOM`
- `Vendor Name`
- `CHOOSE YES TO SEND DATA IN MONTHLY STOCK STATEMENT`
- `Choose mother item from here`
- `QTY IN DEPARTMENT`
- `DOCUMENT LINK`

### Important bug fixed

Earlier the smart mapper could wrongly map the first `Code` column as `SKU CODE` because the source sheet has both `Code` and `SKU CODE`.
That caused rows to import as separate numeric SKUs instead of grouping by `JPK/STOR/...`.

Now `SKU CODE` gets priority over `Code`, so duplicate department rows like Bucket 08 inch import as **one item with multiple department stock rows**.

### Mother item / UOM master auto-create

During import:

- Mother Item names are auto-created uniquely in `mother_items`.
- Existing Mother Items are reused.
- UOM and Secondary UOM are auto-created uniquely in `uoms`.
- Existing UOMs are reused.
- Imported Store Item stores the master ids plus the display names.

### SKU sequence repair

After import, the Store Item sequence is set to the highest imported `JPK/STOR/###` number.
So the next manually added item continues after the last imported SKU.

Example: if import has `JPK/STOR/2367`, next auto SKU becomes `JPK/STOR/2368`.

### Private Google Sheets auth fixed

Google Sheets import now prefers Service Account authentication over API key.
This prevents private sheets from failing when an API key is also present in `.env`.

## If you already imported wrong data

If you already imported once and got numeric SKUs like `1`, `2`, `11`, `12`, first run dry check:

```bash
cd backend
npm run cleanup:bad-google-item-import
```

If it shows only the wrong numeric-SKU rows, soft-delete them:

```bash
CONFIRM_CLEAN_BAD_GOOGLE_ITEMS=true npm run cleanup:bad-google-item-import
```

Then import the Google Sheet again.

## Correct Google Sheets import settings for your current stock sheet

If your range starts at the heading row:

```text
Sheet Name: your tab name
Range: A1:AN3035
Header Row: 1
Target Section: Items / Inventory
```

If there is a title row above the headings, start from the heading row or set the correct header row.

## Run

Backend:

```bash
cd backend
npm install
npm run migrate:ims
npm run seed
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm start
```

## Google Sheets test

```bash
cd backend
npm run test:sheets
```

Use Service Account for private sheets and share the sheet with the service-account email as Viewer.
