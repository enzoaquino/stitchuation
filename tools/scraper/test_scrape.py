# test_scrape.py
import csv
import json
import os
from unittest.mock import patch, MagicMock
from scrape import strip_html
from scrape import fetch_page
from scrape import extract_product
from scrape import scrape_all

def test_strip_html_removes_tags():
    assert strip_html("<p>Hello <b>world</b></p>") == "Hello world"

def test_strip_html_plain_text():
    assert strip_html("no tags here") == "no tags here"

def test_strip_html_empty():
    assert strip_html("") == ""

def test_strip_html_none():
    assert strip_html(None) == ""

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
