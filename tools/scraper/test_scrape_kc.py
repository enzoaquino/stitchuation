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
