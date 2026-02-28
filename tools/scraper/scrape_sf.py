"""Scrape Stitching Fox fiber collection to CSV."""

import csv
import json
import time
from datetime import date
from urllib.error import HTTPError
from urllib.request import urlopen, Request

DELAY_BETWEEN_PAGES = 2  # seconds between requests to avoid rate limiting

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


BASE_URL = "https://www.stitchingfox.com/collections/fiber/products.json"
PAGE_SIZE = 250
MAX_RETRIES = 3


def fetch_page(page_num):
    """Fetch a single page of products. Retries on failure with backoff.
    429 (rate limit) responses are retried indefinitely using Retry-After."""
    url = f"{BASE_URL}?page={page_num}&limit={PAGE_SIZE}"
    req = Request(url, headers={"User-Agent": "NeedlepointScraper/1.0"})
    attempts = 0
    while True:
        try:
            with urlopen(req) as resp:
                data = json.loads(resp.read())
            return data.get("products", [])
        except HTTPError as e:
            if e.code == 429:
                wait = int(e.headers.get("Retry-After", 30))
                print(f"  Rate limited on page {page_num}, waiting {wait}s...")
                time.sleep(wait)
                continue
            attempts += 1
            if attempts < MAX_RETRIES:
                wait = 2 ** attempts
                print(f"  Retry {attempts}/{MAX_RETRIES} after {wait}s: {e}")
                time.sleep(wait)
            else:
                print(f"  FAILED page {page_num} after {MAX_RETRIES} attempts: {e}")
                return []
        except Exception as e:
            attempts += 1
            if attempts < MAX_RETRIES:
                wait = 2 ** attempts
                print(f"  Retry {attempts}/{MAX_RETRIES} after {wait}s: {e}")
                time.sleep(wait)
            else:
                print(f"  FAILED page {page_num} after {MAX_RETRIES} attempts: {e}")
                return []


def scrape_all(output_path=None):
    """Fetch all products and write variant rows to CSV. Returns total row count."""
    if output_path is None:
        output_path = f"sf_threads_{date.today().isoformat()}.csv"

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
        time.sleep(DELAY_BETWEEN_PAGES)

    with open(output_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        for row in all_rows:
            writer.writerow(row)

    print(f"Wrote {len(all_rows)} rows to {output_path}")
    return len(all_rows)


if __name__ == "__main__":
    scrape_all()
