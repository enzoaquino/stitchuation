# KC Needlepoint Thread Scraper Design

## Goal

Scrape all thread products from KC Needlepoint (https://www.kcneedlepoint.com/collections/threads) into a CSV file, with one row per variant (color/SKU).

## Approach

Separate single-file scraper (`scrape_kc.py`) using the Shopify JSON API. Python stdlib only. Same pattern as the Nashville Needleworks scraper but with variant-level row expansion.

## Data Source

- **Endpoint:** `https://www.kcneedlepoint.com/collections/threads/products.json?page=N&limit=250`
- **Total products:** ~2,400 products, ~4,400 variants
- **Pagination:** ~24 pages at limit=250 (page sizes vary; Shopify returns fewer than 250 per page for this store)
- **End condition:** empty products array

## Key Difference from Nashville Scraper

Nashville scraper outputs one row per product. KC Needlepoint has many multi-variant products (e.g. "Accentuate Thread" with 9 color variants). This scraper outputs **one row per variant**, duplicating product-level fields across variant rows.

## CSV Columns (15 fields)

| Column | Source | Level |
|---|---|---|
| `id` | `product.id` | product |
| `title` | `product.title` | product |
| `handle` | `product.handle` | product |
| `body_html` | `product.body_html` (HTML stripped) | product |
| `vendor` | `product.vendor` | product |
| `product_type` | `product.product_type` | product |
| `tags` | `product.tags` (joined with `; `) | product |
| `published_at` | `product.published_at` | product |
| `created_at` | `product.created_at` | product |
| `updated_at` | `product.updated_at` | product |
| `variant_title` | `variant.title` | variant |
| `sku` | `variant.sku` | variant |
| `price` | `variant.price` | variant |
| `compare_at_price` | `variant.compare_at_price` | variant |
| `available` | `variant.available` | variant |

## Architecture

```
Shopify JSON API (page 1..N, up to 250/page)
        |
        v
  Parse JSON, extract product fields
        |
        v
  Expand each product into variant rows
        |
        v
  CSV writer -> kc_threads_YYYY-MM-DD.csv
```

### Functions

- **`strip_html(text)`** — imported from `scrape.py`
- **`extract_variants(product)`** — returns a list of dicts (one per variant), each containing all 15 CSV columns
- **`fetch_page(page_num)`** — fetches one page with 3-attempt retry and exponential backoff
- **`scrape_all(output_path)`** — orchestrates pagination, extraction, and CSV writing

## Error Handling

- Retry HTTP errors (3 attempts with exponential backoff)
- Print progress to stdout
- Log failed pages and continue

## Edge Cases

- Products with zero variants: skip (no row to emit)
- Variant with missing SKU: default to empty string
- `compare_at_price` often null: write empty string

## Testing

`test_scrape_kc.py` using `unittest.mock`:
- `extract_variants` — multi-variant expansion, zero-variant product, missing fields
- `fetch_page` — success, empty page, retry on error
- `scrape_all` — end-to-end CSV verification with mocked fetcher

## Output

`kc_threads_YYYY-MM-DD.csv` (gitignored). Re-run periodically to refresh.
