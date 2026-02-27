"""Scrape Nashville Needleworks thread collection to CSV."""

import csv
import json
import re
import time
from datetime import date
from urllib.request import urlopen, Request


def strip_html(text):
    """Remove HTML tags from a string."""
    if not text:
        return ""
    return re.sub(r"<[^>]+>", "", text)


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
