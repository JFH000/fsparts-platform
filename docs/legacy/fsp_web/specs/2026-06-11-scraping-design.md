# FSParts Product Scraper — Design Spec

**Date:** 2026-06-11
**Status:** Approved

---

## Goal

Migrate all products from the legacy site (fsparts.org, hosted on Hostinger/Zyrosite) into the new Supabase database. The legacy site has no export capability. A one-time Python pipeline scrapes each product page, extracts structured data using CSS selectors + a local LLM, downloads all product images, uploads them to Supabase Storage, and upserts the records into the `products` table.

---

## Scope

- ~200 individual product pages (filtered from ~273 sitemap URLs; category/landing pages are excluded by absence of price)
- Extraction: name, SKU, prices (price_cop + price_ws1), description, specs, refrigerants, images (1–N per product), brand, product_line
- Image handling: download locally → upload to Supabase Storage → store public URLs in `products.images[]`
- Upsert on `sku` conflict (safe to re-run)
- Runs entirely on HPC (Hypatia, Uniandes), no external API costs

Out of scope: `price_usd`, `price_ws2–ws4`, `category_id`, `is_featured`, `is_new` (filled manually after migration).

---

## Project Structure

Standalone Python project at `scraping/` in the repo root, managed with `uv`. Not part of the Vue app.

```
scraping/
├── pyproject.toml
├── .python-version          # 3.11
├── .env                     # SUPABASE_URL, SUPABASE_KEY
├── notebooks/
│   ├── 00_inspect.ipynb     # Inspect 5 random products, tune selectors + prompt
│   └── 01_pipeline.ipynb    # Full pipeline: crawl → extract → images → upsert
└── src/
    └── fsparts_scraper/
        ├── __init__.py
        ├── crawler.py        # Fetch sitemap → filter product URLs
        ├── extractor.py      # Playwright fetch + CSS selectors
        ├── llm.py            # Load Qwen2.5-14B-Instruct, structured JSON extraction
        ├── mapper.py         # Brand/product_line lookup tables for LLM prompt
        ├── images.py         # Download images locally + upload to Supabase Storage
        ├── supabase_client.py # Upsert products
        └── checkpoint.py     # Read/write data/checkpoints/<sku>.json
data/
├── checkpoints/              # One JSON file per processed product
└── images/                   # <sku>/<index>.jpg (local cache before upload)
```

---

## Dependencies

Same CUDA 11.8 / torch stack as other HPC projects:

```toml
[project]
name = "fsparts-scraper"
requires-python = ">=3.11, <=3.14"
dependencies = [
    "torch==2.6.0+cu118",
    "transformers==4.46.3",
    "tokenizers==0.20.3",
    "accelerate>=0.26.0",
    "bitsandbytes>=0.42.0",
    "playwright>=1.44.0",
    "httpx>=0.27.0",
    "beautifulsoup4>=4.12.0",
    "supabase>=2.4.0",
    "python-dotenv>=1.0.0",
    "tqdm>=4.66.0",
    "ipykernel>=6.0.0",
    "jupyter>=1.1.0",
]

[[tool.uv.index]]
name = "pytorch-cu118"
url = "https://download.pytorch.org/whl/cu118"
explicit = true

[tool.uv.sources]
torch = { index = "pytorch-cu118" }
```

After install: `playwright install chromium`

---

## Checkpoint Schema

Each product is saved as `data/checkpoints/<sku>.json`. The `status` field drives resume logic.

```json
{
  "sku": "DK-032S",
  "name": "Filtro Secador Conexión Soldar DK-032S 1/4\"",
  "slug": "filtro-secador-conexion-soldar-dk-032s-1-4",
  "description": "Componente crítico para sistemas de refrigeración...",
  "price_cop": 54900,
  "price_ws1": 45000,
  "brand_id": 23,
  "product_line_id": 5,
  "specs": [
    { "label": "Modelo", "value": "DK-032S" },
    { "label": "Conexión", "value": "ODF / Soldar 1/4\"" },
    { "label": "Presión máx.", "value": "600 PSIG / 4200 kPa" }
  ],
  "refrigerants": ["R134A", "R410A", "R22", "R404A"],
  "image_urls_original": [
    "https://assets.zyrosite.com/.../img1.webp",
    "https://assets.zyrosite.com/.../img2.webp"
  ],
  "images": [],
  "source_url": "https://www.fsparts.org/filtro-secador-conexion-soldar-dk-032s-14-refrigeracion",
  "status": "extracted"
}
```

**Status lifecycle:**
- `extracted` — CSS + LLM done, images not yet uploaded
- `images_done` — images uploaded to Supabase Storage, `images[]` has public URLs
- `upserted` — product row exists in Supabase

Each pipeline phase skips products already at or past the required status.

---

## Pipeline Phases

### Phase 0: Inspection (notebook `00_inspect.ipynb`)

Before the full run, inspect 5 random product URLs:
1. Render page with Playwright, print HTML snippet
2. Run CSS selectors, show extracted raw values
3. Run LLM on the HTML, show extracted JSON
4. Adjust selectors or prompt as needed

This cell must pass before running Phase 1.

### Phase 1: Crawl (`crawler.py`)

1. Fetch `https://www.fsparts.org/sitemap.xml`
2. Filter URLs: keep only those that look like product pages (heuristic: URL has ≥3 hyphens and is not in a known category slug list)
3. For each candidate URL, do a lightweight check: render with Playwright, confirm a price element exists
4. Write confirmed product URLs to `data/urls.txt` (one per line)

~200 URLs expected.

### Phase 2: Extract (`extractor.py` + `llm.py`)

For each URL in `data/urls.txt` where no checkpoint exists yet:

1. **Playwright fetch** — `browser.new_page()` → `page.goto(url, wait_until='networkidle')` → `page.content()`
2. **CSS selectors** (deterministic):
   - Crossed-out price: first `<del>` or `<s>` tag containing `CO$` → `price_cop`
   - Visible price: price element after the tachado → `price_ws1`
   - Images: all `<img>` tags inside the main content area, excluding any whose `src` matches `logo-final-de-fs` or `logo` in the URL → `image_urls_original[]`
3. **Clean HTML** — strip `<script>`, `<style>`, `<nav>`, `<footer>` tags; keep product body only
4. **LLM extraction** — send cleaned HTML to Qwen2.5-14B-Instruct with structured prompt (see below); parse JSON response
5. **Merge** — combine CSS-extracted fields + LLM-extracted fields into checkpoint JSON
6. **Write checkpoint** with `status: "extracted"`

If the LLM response is not valid JSON, retry once with a stricter prompt. If still invalid, write `status: "extraction_failed"` and continue.

### Phase 3: Images (`images.py`)

For each checkpoint with `status: "extracted"`:

1. For each URL in `image_urls_original`:
   - Download to `data/images/<sku>/<index>.jpg` with httpx
   - Skip if file already exists (resume-safe)
2. Upload each local file to Supabase Storage: `product-images/products/<sku>/<index>.jpg`
3. Get public URL via `storage.get_public_url()`
4. Update checkpoint: `images = [<public_url_0>, <public_url_1>, ...]`, `status: "images_done"`

### Phase 4: Upsert (`supabase_client.py`)

For each checkpoint with `status: "images_done"`:

```python
supabase.table("products").upsert({
    "sku": ..., "name": ..., "slug": ..., "description": ...,
    "price_cop": ..., "price_ws1": ...,
    "brand_id": ..., "product_line_id": ...,
    "specs": ..., "refrigerants": ..., "images": ...,
    "stock": 0,
}, on_conflict="sku").execute()
```

Update checkpoint to `status: "upserted"`.

---

## LLM Strategy

**Model:** `Qwen/Qwen2.5-14B-Instruct` loaded with 4-bit quantization via bitsandbytes:

```python
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

quant_config = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_compute_dtype=torch.float16)
model = AutoModelForCausalLM.from_pretrained(
    "Qwen/Qwen2.5-14B-Instruct",
    quantization_config=quant_config,
    device_map="auto",
)
```

**System prompt** (includes full lookup tables so the LLM can return IDs directly):

```
Eres un extractor de datos de productos HVAC/R. Devuelve ÚNICAMENTE JSON válido.

Marcas disponibles (usa el id numérico):
1=Full Gauge, 2=Parker, 3=Invotech, 4=York, 5=Danfoss, 6=Lefoo,
7=GMCC, 8=Chemours, 9=Corestar, 10=Shtrol, 11=AMG, 23=FS Parts

Líneas de producto disponibles (usa el id numérico):
1=Controles y Electrónica, 2=Válvulas, 3=Compresores,
4=Ventilación, 5=Accesorios de Refrigeración, 6=Aires Acondicionados, 7=Refrigerantes

Schema requerido:
{
  "sku": "string | null",
  "name": "string",
  "description": "string",
  "brand_id": "number | null",
  "product_line_id": "number | null",
  "specs": [{"label": "string", "value": "string"}],
  "refrigerants": ["R22", "R410A", ...]
}

Reglas:
- sku: busca código de modelo (ej: DK-032S, MT530, YH150C7-100). Si no hay, usa null.
- specs: extrae TODOS los pares técnicos del producto, incluyendo los del nombre y descripción.
- refrigerants: extrae solo códigos R### mencionados en cualquier parte de la página.
- Si un campo no aplica, usa null o [].
```

---

## Supabase Storage

Bucket: `product-images` (public, created manually before running the pipeline if not exists).
Path pattern: `products/<sku>/<index>.jpg`
Public URL pattern: `<SUPABASE_URL>/storage/v1/object/public/product-images/products/<sku>/<index>.jpg`

---

## Existing Supabase Data

**Brands** (id → name): 1=Full Gauge, 2=Parker, 3=Invotech, 4=York, 5=Danfoss, 6=Lefoo, 7=GMCC, 8=Chemours, 9=Corestar, 10=Shtrol, 11=AMG, 23=FS Parts

**Product lines** (id → code → name):
1=L01=Controles y Electrónica, 2=L02=Válvulas, 3=L03=Compresores,
4=L04=Ventilación, 5=L05=Accesorios de Refrigeración, 6=L06=Aires Acondicionados, 7=L07=Refrigerantes

---

## Error Handling

- **LLM returns invalid JSON**: retry once with stricter prompt ("devuelve SOLO el JSON, sin texto adicional"). If still invalid: `status: "extraction_failed"`, log URL, continue.
- **Image download fails**: skip that image, continue with remaining. Log failed URLs.
- **Supabase upsert fails**: log error + checkpoint sku, continue. Re-runnable.
- **Playwright timeout**: skip URL, mark `status: "fetch_failed"`, continue.

A summary cell in `01_pipeline.ipynb` prints counts per status at the end of each phase.

---

## Fields Left Empty After Migration

To be filled manually via the admin panel after migration:
- `price_usd`, `price_ws2`, `price_ws3`, `price_ws4`
- `category_id`
- `is_featured`, `is_new` (default `false`)
- `ref_code` (not present on legacy site)
- `stock` (set to 0; use stock management module to enter initial stock)
