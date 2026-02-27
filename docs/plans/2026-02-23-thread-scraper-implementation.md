# Thread Scraper Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Scrape all ~13,000 needlepoint thread products from Nashville Needleworks' Shopify JSON API into a timestamped CSV file.

**Architecture:** Single Python script (`scrape.py`) using only stdlib. Paginates through `/collections/thread/products.json?page=N&limit=250`, extracts product fields + first variant SKU, writes to `threads_YYYY-MM-DD.csv`. Retries failed pages with exponential backoff.

**Tech Stack:** Python 3 stdlib only (`urllib.request`, `json`, `csv`, `re`, `time`, `datetime`)

---

### Task 1: HTML tag stripper

**Files:**
- Create: `scrape.py`
- Create: `test_scrape.py`

**Step 1: Write the failing test**

```python
# test_scrape.py
from scrape import strip_html

def test_strip_html_removes_tags():
    assert strip_html("<p>Hello <b>world</b></p>") == "Hello world"

def test_strip_html_plain_text():
    assert strip_html("no tags here") == "no tags here"

def test_strip_html_empty():
    assert strip_html("") == ""

def test_strip_html_none():
    assert strip_html(None) == ""
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest test_scrape.py -v`
Expected: FAIL — `scrape` module does not exist yet

**Step 3: Write minimal implementation**

```python
# scrape.py
"""Scrape Nashville Needleworks thread collection to CSV."""

import re

def strip_html(text):
    """Remove HTML tags from a string."""
    if not text:
        return ""
    return re.sub(r"<[^>]+>", "", text)
```

**Step 4: Run test to verify it passes**

Run: `python -m pytest test_scrape.py -v`
Expected: All 4 tests PASS

**Step 5: Commit**

```bash
git add scrape.py test_scrape.py
git commit -m "feat: add strip_html utility"
```

---

### Task 2: Product field extraction

**Files:**
- Modify: `scrape.py`
- Modify: `test_scrape.py`

**Step 1: Write the failing test**

```python
# append to test_scrape.py
from scrape import extract_product

SAMPLE_PRODUCT = {
    "id": 123,
    "title": "01 Rain, DMC Perle Cotton #5 Skein",
    "handle": "01-rain-dmc-perle-cotton-5-skein",
    "body_html": "<p>DMC Pearl Cotton</p>",
    "vendor": "Fleur de Paris",
    "product_type": "Inventory",
    "tags": ["DMC P5", "Thread"],
    "published_at": "2026-01-17T09:06:13-06:00",
    "created_at": "2026-01-17T09:06:13-06:00",
    "updated_at": "2026-02-23T12:40:17-06:00",
    "variants": [{"sku": "5/01"}],
}

def test_extract_product_all_fields():
    row = extract_product(SAMPLE_PRODUCT)
    assert row["id"] == 123
    assert row["title"] == "01 Rain, DMC Perle Cotton #5 Skein"
    assert row["handle"] == "01-rain-dmc-perle-cotton-5-skein"
    assert row["body_html"] == "DMC Pearl Cotton"
    assert row["vendor"] == "Fleur de Paris"
    assert row["product_type"] == "Inventory"
    assert row["tags"] == "DMC P5; Thread"
    assert row["published_at"] == "2026-01-17T09:06:13-06:00"
    assert row["created_at"] == "2026-01-17T09:06:13-06:00"
    assert row["updated_at"] == "2026-02-23T12:40:17-06:00"
    assert row["sku"] == "5/01"

def test_extract_product_no_variants():
    product = {**SAMPLE_PRODUCT, "variants": []}
    row = extract_product(product)
    assert row["sku"] == ""

def test_extract_product_tags_empty():
    product = {**SAMPLE_PRODUCT, "tags": []}
    row = extract_product(product)
    assert row["tags"] == ""
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest test_scrape.py::test_extract_product_all_fields -v`
Expected: FAIL — `extract_product` not defined

**Step 3: Write minimal implementation**

```python
# append to scrape.py

CSV_COLUMNS = [
    "id", "title", "handle", "body_html", "vendor",
    "product_type", "tags", "published_at", "created_at",
    "updated_at", "sku",
]

def extract_product(product):
    """Extract a flat dict of CSV fields from a Shopify product dict."""
    variants = product.get("variants", [])
    sku = variants[0].get("sku", "") if variants else ""
    tags = product.get("tags", [])
    return {
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
        "sku": sku,
    }
```

**Step 4: Run test to verify it passes**

Run: `python -m pytest test_scrape.py -v`
Expected: All 7 tests PASS

**Step 5: Commit**

```bash
git add scrape.py test_scrape.py
git commit -m "feat: add product field extraction"
```

---

### Task 3: Page fetching with retry

**Files:**
- Modify: `scrape.py`
- Modify: `test_scrape.py`

**Step 1: Write the failing test**

```python
# append to test_scrape.py
import json
from unittest.mock import patch, MagicMock
from scrape import fetch_page

def _mock_urlopen(products):
    """Create a mock urlopen response with given products."""
    body = json.dumps({"products": products}).encode()
    mock_resp = MagicMock()
    mock_resp.read.return_value = body
    mock_resp.__enter__ = lambda s: s
    mock_resp.__exit__ = MagicMock(return_value=False)
    return mock_resp

@patch("scrape.urlopen")
def test_fetch_page_returns_products(mock_urlopen):
    mock_urlopen.return_value = _mock_urlopen([{"id": 1}, {"id": 2}])
    products = fetch_page(1)
    assert len(products) == 2
    assert products[0]["id"] == 1

@patch("scrape.urlopen")
def test_fetch_page_empty(mock_urlopen):
    mock_urlopen.return_value = _mock_urlopen([])
    products = fetch_page(5)
    assert products == []

@patch("scrape.urlopen")
def test_fetch_page_retries_on_error(mock_urlopen):
    mock_urlopen.side_effect = [
        Exception("Connection error"),
        _mock_urlopen([{"id": 1}]),
    ]
    products = fetch_page(1)
    assert len(products) == 1
    assert mock_urlopen.call_count == 2
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest test_scrape.py::test_fetch_page_returns_products -v`
Expected: FAIL — `fetch_page` not defined

**Step 3: Write minimal implementation**

```python
# add imports at top of scrape.py
import json
import time
from urllib.request import urlopen, Request

BASE_URL = "https://www.nashvilleneedleworks.com/collections/thread/products.json"
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

**Step 4: Run test to verify it passes**

Run: `python -m pytest test_scrape.py -v`
Expected: All 10 tests PASS

**Step 5: Commit**

```bash
git add scrape.py test_scrape.py
git commit -m "feat: add page fetching with retry logic"
```

---

### Task 4: Main scrape loop and CSV writing

**Files:**
- Modify: `scrape.py`
- Modify: `test_scrape.py`

**Step 1: Write the failing test**

```python
# append to test_scrape.py
import csv
import os
from unittest.mock import patch
from scrape import scrape_all

@patch("scrape.fetch_page")
def test_scrape_all_writes_csv(mock_fetch, tmp_path):
    mock_fetch.side_effect = [
        [SAMPLE_PRODUCT, {**SAMPLE_PRODUCT, "id": 456, "title": "Test 2", "variants": []}],
        [],  # empty page ends pagination
    ]
    outfile = tmp_path / "test_output.csv"
    count = scrape_all(str(outfile))
    assert count == 2
    assert outfile.exists()

    with open(outfile, newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    assert len(rows) == 2
    assert rows[0]["id"] == "123"
    assert rows[0]["sku"] == "5/01"
    assert rows[1]["id"] == "456"
    assert rows[1]["sku"] == ""

@patch("scrape.fetch_page")
def test_scrape_all_no_products(mock_fetch, tmp_path):
    mock_fetch.return_value = []
    outfile = tmp_path / "empty.csv"
    count = scrape_all(str(outfile))
    assert count == 0
    assert outfile.exists()
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest test_scrape.py::test_scrape_all_writes_csv -v`
Expected: FAIL — `scrape_all` not defined

**Step 3: Write minimal implementation**

```python
# add import at top of scrape.py
import csv
from datetime import date

def scrape_all(output_path=None):
    """Fetch all products and write to CSV. Returns total product count."""
    if output_path is None:
        output_path = f"threads_{date.today().isoformat()}.csv"

    all_products = []
    page = 1
    while True:
        print(f"Fetching page {page}...")
        products = fetch_page(page)
        if not products:
            break
        all_products.extend(products)
        print(f"  Got {len(products)} products (total: {len(all_products)})")
        page += 1

    with open(output_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        for product in all_products:
            writer.writerow(extract_product(product))

    print(f"Wrote {len(all_products)} products to {output_path}")
    return len(all_products)


if __name__ == "__main__":
    scrape_all()
```

**Step 4: Run test to verify it passes**

Run: `python -m pytest test_scrape.py -v`
Expected: All 12 tests PASS

**Step 5: Commit**

```bash
git add scrape.py test_scrape.py
git commit -m "feat: add main scrape loop and CSV output"
```

---

### Task 5: Add .gitignore and update CLAUDE.md

**Files:**
- Create: `.gitignore`
- Modify: `CLAUDE.md`

**Step 1: Create .gitignore**

```
# Output files
threads_*.csv

# Python
__pycache__/
*.pyc
.pytest_cache/
```

**Step 2: Update CLAUDE.md with project commands**

Update the CLAUDE.md to include actual build/run/test commands now that the project exists.

**Step 3: Commit**

```bash
git add .gitignore CLAUDE.md
git commit -m "chore: add gitignore and update CLAUDE.md"
```

---

### Task 6: End-to-end smoke test

**Step 1: Run the scraper against the real API (limited)**

Run: `python -c "from scrape import fetch_page, extract_product; ps = fetch_page(1); print(len(ps), 'products'); print(extract_product(ps[0]))"`
Expected: Prints `250 products` and a dict with all 11 fields populated

**Step 2: Run the full scraper**

Run: `python scrape.py`
Expected: Pages through all ~53 pages, writes `threads_2026-02-23.csv` with ~13,000 rows

**Step 3: Verify output**

Run: `wc -l threads_2026-02-23.csv && head -2 threads_2026-02-23.csv`
Expected: ~13,093 lines (header + products), header row matches CSV_COLUMNS

**Step 4: Commit any final adjustments**

```bash
git add -A && git commit -m "chore: final adjustments after smoke test"
```
