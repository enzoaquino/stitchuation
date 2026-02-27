# KC Needlepoint Scraper Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Scrape all thread products from KC Needlepoint into a CSV with one row per variant.

**Architecture:** Single file `scrape_kc.py` using Shopify JSON API, stdlib only. Imports `strip_html` from `scrape.py`. Expands each product's variants into separate CSV rows.

**Tech Stack:** Python 3.9+ stdlib (urllib, json, csv, re, time, datetime), pytest for tests.

---

### Task 1: extract_variants — test and implement

**Files:**
- Create: `test_scrape_kc.py`
- Create: `scrape_kc.py`

**Step 1: Write the test file with extract_variants tests**

Create `test_scrape_kc.py`:

```python
# test_scrape_kc.py
import csv
import json
from unittest.mock import patch, MagicMock
from scrape_kc import extract_variants

SAMPLE_PRODUCT = {
    "id": 5554091847,
    "title": "Accentuate Thread",
    "handle": "accentuate-thread",
    "body_html": "<p>Accentuate Strong Metallic Filament, 50 meters</p>",
    "vendor": "Access Commodities",
    "product_type": "Accentuate",
    "tags": ["accentuate", "fibers"],
    "published_at": "2016-03-10T16:36:11-06:00",
    "created_at": "2016-03-10T16:36:11-06:00",
    "updated_at": "2026-02-26T17:41:56-06:00",
    "variants": [
        {
            "title": "015 Rouge",
            "sku": "AC015",
            "price": "3.50",
            "compare_at_price": None,
            "available": True,
        },
        {
            "title": "071 Black",
            "sku": "AC071",
            "price": "3.50",
            "compare_at_price": "5.00",
            "available": False,
        },
    ],
}


def test_extract_variants_multi():
    rows = extract_variants(SAMPLE_PRODUCT)
    assert len(rows) == 2
    # First variant
    assert rows[0]["id"] == 5554091847
    assert rows[0]["title"] == "Accentuate Thread"
    assert rows[0]["handle"] == "accentuate-thread"
    assert rows[0]["body_html"] == "Accentuate Strong Metallic Filament, 50 meters"
    assert rows[0]["vendor"] == "Access Commodities"
    assert rows[0]["product_type"] == "Accentuate"
    assert rows[0]["tags"] == "accentuate; fibers"
    assert rows[0]["published_at"] == "2016-03-10T16:36:11-06:00"
    assert rows[0]["created_at"] == "2016-03-10T16:36:11-06:00"
    assert rows[0]["updated_at"] == "2026-02-26T17:41:56-06:00"
    assert rows[0]["variant_title"] == "015 Rouge"
    assert rows[0]["sku"] == "AC015"
    assert rows[0]["price"] == "3.50"
    assert rows[0]["compare_at_price"] == ""
    assert rows[0]["available"] == True
    # Second variant
    assert rows[1]["variant_title"] == "071 Black"
    assert rows[1]["sku"] == "AC071"
    assert rows[1]["compare_at_price"] == "5.00"
    assert rows[1]["available"] == False


def test_extract_variants_no_variants():
    product = {**SAMPLE_PRODUCT, "variants": []}
    rows = extract_variants(product)
    assert rows == []


def test_extract_variants_missing_sku():
    product = {**SAMPLE_PRODUCT, "variants": [{"title": "Default", "price": "1.00", "available": True}]}
    rows = extract_variants(product)
    assert len(rows) == 1
    assert rows[0]["sku"] == ""
    assert rows[0]["compare_at_price"] == ""
```

**Step 2: Create scrape_kc.py with extract_variants**

Create `scrape_kc.py`:

```python
"""Scrape KC Needlepoint thread collection to CSV."""

import csv
import json
import time
from datetime import date
from urllib.request import urlopen, Request

from scrape import strip_html


CSV_COLUMNS = [
    "id", "title", "handle", "body_html", "vendor",
    "product_type", "tags", "published_at", "created_at",
    "updated_at", "variant_title", "sku", "price",
    "compare_at_price", "available",
]


def extract_variants(product):
    """Expand a Shopify product into a list of per-variant row dicts."""
    variants = product.get("variants", [])
    if not variants:
        return []
    tags = product.get("tags", [])
    base = {
        "id": product["id"],
        "title": product["title"],
        "handle": product["handle"],
        "body_html": strip_html(product.get("body_html", "")),
        "vendor": product.get("vendor", ""),
        "product_type": product.get("product_type", ""),
        "tags": "; ".join(tags),
        "published_at": product.get("published_at", ""),
        "created_at": product.get("created_at", ""),
        "updated_at": product.get("updated_at", ""),
    }
    rows = []
    for v in variants:
        row = dict(base)
        row["variant_title"] = v.get("title", "")
        row["sku"] = v.get("sku", "")
        row["price"] = v.get("price", "")
        row["compare_at_price"] = v.get("compare_at_price") or ""
        row["available"] = v.get("available", False)
        rows.append(row)
    return rows
```

**Step 3: Run tests to verify they pass**

Run: `python -m pytest test_scrape_kc.py -v -k extract`
Expected: 3 tests PASS

**Step 4: Commit**

```bash
git add scrape_kc.py test_scrape_kc.py
git commit -m "feat(kc): add extract_variants with tests"
```

---

### Task 2: fetch_page — test and implement

**Files:**
- Modify: `test_scrape_kc.py` (add tests)
- Modify: `scrape_kc.py` (add fetch_page)

**Step 1: Add fetch_page tests to test_scrape_kc.py**

Append to `test_scrape_kc.py`:

```python
from scrape_kc import fetch_page


def _mock_urlopen(products):
    """Create a mock urlopen response with given products."""
    body = json.dumps({"products": products}).encode()
    mock_resp = MagicMock()
    mock_resp.read.return_value = body
    mock_resp.__enter__ = lambda s: s
    mock_resp.__exit__ = MagicMock(return_value=False)
    return mock_resp


@patch("scrape_kc.urlopen")
def test_fetch_page_returns_products(mock_urlopen):
    mock_urlopen.return_value = _mock_urlopen([{"id": 1}, {"id": 2}])
    products = fetch_page(1)
    assert len(products) == 2
    assert products[0]["id"] == 1


@patch("scrape_kc.urlopen")
def test_fetch_page_empty(mock_urlopen):
    mock_urlopen.return_value = _mock_urlopen([])
    products = fetch_page(5)
    assert products == []


@patch("scrape_kc.urlopen")
def test_fetch_page_retries_on_error(mock_urlopen):
    mock_urlopen.side_effect = [
        Exception("Connection error"),
        _mock_urlopen([{"id": 1}]),
    ]
    products = fetch_page(1)
    assert len(products) == 1
    assert mock_urlopen.call_count == 2
```

**Step 2: Add fetch_page to scrape_kc.py**

Append to `scrape_kc.py` (after `extract_variants`):

```python
BASE_URL = "https://www.kcneedlepoint.com/collections/threads/products.json"
PAGE_SIZE = 250
MAX_RETRIES = 3


def fetch_page(page_num):
    """Fetch a single page of products. Retries on failure with backoff."""
    url = f"{BASE_URL}?page={page_num}&limit={PAGE_SIZE}"
    req = Request(url, headers={"User-Agent": "NeedlepointScraper/1.0"})
    for attempt in range(MAX_RETRIES):
        try:
            with urlopen(req) as resp:
                data = json.loads(resp.read())
            return data.get("products", [])
        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                wait = 2 ** attempt
                print(f"  Retry {attempt + 1}/{MAX_RETRIES - 1} after {wait}s: {e}")
                time.sleep(wait)
            else:
                print(f"  FAILED page {page_num} after {MAX_RETRIES} attempts: {e}")
                return []
```

**Step 3: Run tests to verify they pass**

Run: `python -m pytest test_scrape_kc.py -v -k fetch`
Expected: 3 tests PASS

**Step 4: Commit**

```bash
git add scrape_kc.py test_scrape_kc.py
git commit -m "feat(kc): add fetch_page with retry logic"
```

---

### Task 3: scrape_all — test and implement

**Files:**
- Modify: `test_scrape_kc.py` (add tests)
- Modify: `scrape_kc.py` (add scrape_all + main block)

**Step 1: Add scrape_all tests to test_scrape_kc.py**

Append to `test_scrape_kc.py`:

```python
from scrape_kc import scrape_all


@patch("scrape_kc.fetch_page")
def test_scrape_all_writes_csv(mock_fetch, tmp_path):
    mock_fetch.side_effect = [
        [SAMPLE_PRODUCT],
        [],  # empty page ends pagination
    ]
    outfile = tmp_path / "test_output.csv"
    count = scrape_all(str(outfile))
    assert count == 2  # 2 variants from SAMPLE_PRODUCT
    assert outfile.exists()

    with open(outfile, newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    assert len(rows) == 2
    assert rows[0]["id"] == "5554091847"
    assert rows[0]["variant_title"] == "015 Rouge"
    assert rows[0]["sku"] == "AC015"
    assert rows[0]["price"] == "3.50"
    assert rows[0]["available"] == "True"
    assert rows[1]["variant_title"] == "071 Black"
    assert rows[1]["sku"] == "AC071"


@patch("scrape_kc.fetch_page")
def test_scrape_all_no_products(mock_fetch, tmp_path):
    mock_fetch.return_value = []
    outfile = tmp_path / "empty.csv"
    count = scrape_all(str(outfile))
    assert count == 0
    assert outfile.exists()


@patch("scrape_kc.fetch_page")
def test_scrape_all_skips_zero_variant_products(mock_fetch, tmp_path):
    no_variants = {**SAMPLE_PRODUCT, "id": 999, "variants": []}
    mock_fetch.side_effect = [
        [SAMPLE_PRODUCT, no_variants],
        [],
    ]
    outfile = tmp_path / "test_output.csv"
    count = scrape_all(str(outfile))
    assert count == 2  # only the 2 variants from SAMPLE_PRODUCT, not no_variants
```

**Step 2: Add scrape_all and main block to scrape_kc.py**

Append to `scrape_kc.py`:

```python
def scrape_all(output_path=None):
    """Fetch all products and write variant rows to CSV. Returns total row count."""
    if output_path is None:
        output_path = f"kc_threads_{date.today().isoformat()}.csv"

    all_rows = []
    page = 1
    while True:
        print(f"Fetching page {page}...")
        products = fetch_page(page)
        if not products:
            break
        for product in products:
            all_rows.extend(extract_variants(product))
        print(f"  Got {len(products)} products (total rows: {len(all_rows)})")
        page += 1

    with open(output_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        for row in all_rows:
            writer.writerow(row)

    print(f"Wrote {len(all_rows)} rows to {output_path}")
    return len(all_rows)


if __name__ == "__main__":
    scrape_all()
```

**Step 3: Run all tests to verify they pass**

Run: `python -m pytest test_scrape_kc.py -v`
Expected: 9 tests PASS

**Step 4: Commit**

```bash
git add scrape_kc.py test_scrape_kc.py
git commit -m "feat(kc): add scrape_all with CSV output and main block"
```

---

### Task 4: Update gitignore and CLAUDE.md

**Files:**
- Modify: `.gitignore`
- Modify: `CLAUDE.md`

**Step 1: Add kc_threads output pattern to .gitignore**

Add this line to `.gitignore`:

```
kc_threads_*.csv
```

**Step 2: Update CLAUDE.md with KC scraper info**

Add a section to `CLAUDE.md` describing the new scraper. After the existing architecture section, add:

```markdown
## KC Needlepoint Scraper

Separate scraper for KC Needlepoint (https://www.kcneedlepoint.com/collections/threads).

```bash
# Run the KC scraper (outputs kc_threads_YYYY-MM-DD.csv)
python scrape_kc.py

# Run KC tests
python -m pytest test_scrape_kc.py -v
```

Key difference from Nashville scraper: outputs **one row per variant** (not one row per product), since KC Needlepoint has many multi-variant products. CSV has 15 columns (10 product-level + 5 variant-level: variant_title, sku, price, compare_at_price, available).
```

**Step 3: Run all tests (both scrapers) to verify nothing broke**

Run: `python -m pytest test_scrape.py test_scrape_kc.py -v`
Expected: 21 tests PASS (12 Nashville + 9 KC)

**Step 4: Commit**

```bash
git add .gitignore CLAUDE.md
git commit -m "chore: update gitignore and CLAUDE.md for KC scraper"
```
