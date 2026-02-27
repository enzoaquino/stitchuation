# Thread Scraper Design

## Goal

Scrape all ~13,000 needlepoint thread products from Nashville Needleworks into a CSV file for use in a database.

## Approach

Use the Shopify JSON API (`/collections/thread/products.json`) — no HTML scraping needed. Single Python script with stdlib only (no external dependencies).

## Data Source

- **Endpoint:** `https://www.nashvilleneedleworks.com/collections/thread/products.json?page=N&limit=250`
- **Total products:** ~13,092
- **Pagination:** ~53 pages at 250 products per page
- **Rate limits:** Shopify JSON endpoints are generous; no throttling expected

## CSV Columns

| Column | Source |
|---|---|
| `id` | `product.id` |
| `title` | `product.title` |
| `handle` | `product.handle` |
| `body_html` | `product.body_html` (HTML tags stripped) |
| `vendor` | `product.vendor` |
| `product_type` | `product.product_type` |
| `tags` | `product.tags` (joined with `; `) |
| `published_at` | `product.published_at` |
| `created_at` | `product.created_at` |
| `updated_at` | `product.updated_at` |
| `sku` | `product.variants[0].sku` |

## Architecture

Single file: `scrape.py`

```
Shopify JSON API (page 1..N, 250/page)
        |
        v
  Parse JSON, extract fields
        |
        v
  CSV writer -> threads_YYYY-MM-DD.csv
```

## Usage Pattern

Re-run periodically to refresh data. Each run produces a fresh timestamped CSV (`threads_YYYY-MM-DD.csv`).

## Error Handling

- Retry HTTP errors (3 attempts with exponential backoff)
- Print progress to stdout (e.g. `Page 1/53... 250 products`)
- Log failed pages and continue with remaining pages

## Edge Cases

- Products with no variants: SKU defaults to empty string
- Products with multiple variants: use first variant's SKU
- Empty page response signals end of pagination
