#!/usr/bin/env python3
"""
ClaimDepot Settlement Scraper
=============================
Scrapes class action settlement data from https://www.claimdepot.com/settlements
and writes structured JSON to public/settlements-data/claimdepot-settlements.json

Strategy:
  1. Fetch the RSS feed (100 most-recent settlements with title, link, description, image, pubDate)
  2. Fetch the main listings page to extract category for each slug
  3. For each settlement, fetch its detail page to extract: status, deadline,
     days left, estimated payout, settlement amount, case number, court info, etc.
  4. Merge everything into a unified JSON structure and write to disk

Output format is consumed by the Next.js API route at /api/settlements.
Run this script daily via a cron job to keep the data fresh.
"""

import json
import re
import sys
import os
from datetime import datetime, timezone
from html import unescape
from xml.etree import ElementTree as ET
from urllib.parse import urlparse

import urllib.request

CLAIMDEPOT_RSS = "https://www.claimdepot.com/settlements/rss.xml"
CLAIMDEPOT_LISTINGS = "https://www.claimdepot.com/settlements"
OUTPUT_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..",
    "public",
    "settlements-data",
    "claimdepot-settlements.json",
)

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


def fetch_url(url: str, retries: int = 2) -> str:
    """Fetch a URL with the given user-agent. Returns HTML/text content."""
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=30) as resp:
                content = resp.read().decode("utf-8", errors="replace")
                return content
        except Exception as e:
            if attempt == retries:
                print(f"  [ERROR] Failed to fetch {url}: {e}", file=sys.stderr)
                return ""
            print(f"  [WARN] Retry {attempt+1}/{retries} for {url}: {e}", file=sys.stderr)
    return ""


def parse_rss(html: str) -> list[dict]:
    """Parse the RSS XML into a list of settlement items."""
    root = ET.fromstring(html)
    ns = {"media": "http://search.yahoo.com/mrss/"}

    items = []
    for item in root.iter("item"):
        link_elem = item.find("link")
        title_elem = item.find("title")
        desc_elem = item.find("description")
        pubdate_elem = item.find("pubDate")
        media_thumb = item.find("media:thumbnail", ns)

        link = link_elem.text.strip() if link_elem is not None else ""
        slug = ""
        if link:
            path = urlparse(link).path
            slug = path.strip("/").replace("settlements/", "")

        image_url = ""
        if media_thumb is not None and media_thumb.get("url"):
            image_url = media_thumb.get("url")
        # Extract estimated payout from description
        # RSS description format: "Core description.\\n\\nEstimated Payout: details"
        est_payout = None
        full_desc = unescape(desc_elem.text.strip()) if desc_elem is not None else ""
        ep_match = re.search(r"Estimated Payout:\s*(.+?)(?:\n|$)", full_desc)
        if ep_match:
            est_payout = ep_match.group(1).strip()

        # Extract the core description (before "Estimated Payout" line)
        core_desc = full_desc
        ep_sep = re.search(r"\n\nEstimated Payout:", full_desc)
        if ep_sep:
            core_desc = full_desc[: ep_sep.start()].strip()

        items.append({
            "slug": slug,
            "title": unescape(title_elem.text.strip()) if title_elem is not None else "",
            "description": core_desc,
            "estimatedAmount": est_payout,
            "imageUrl": image_url,
            "claimUrl": link,
            "publishedAt": pubdate_elem.text.strip() if pubdate_elem is not None else "",
        })

    return items


def extract_listing_categories(html: str) -> dict[str, str]:
    """Extract per-slug category from the main listings page.

    The ClaimDepot listings page uses JetBoost with hidden input values
    matching the category slug, and category text in tn-category divs.
    """
    result = {}
    pattern = r'href="/settlements/([a-z0-9\-]+)"[^>]*>.*?class="tn-category">([^<]*)'
    for slug, category in re.findall(pattern, html, re.DOTALL):
        result[slug] = category.strip()
    return result


def parse_detail_page(html: str) -> dict:
    """Extract detailed fields from a single settlement detail page.

    HTML structure on ClaimDepot:
      <div class="case-data-item">
        <div class="case-data-label">Status</div>
        <a href="..."><div class="case-title-data summary-status">Open for Claims</div></a>
      </div>
    The label is in a case-data-label div, the value is in the next
    case-title-data div (may be inside an <a> or directly in the div).
    Categories are in tn-category divs on the detail page.
    """
    result = {}

    # Extract label/value pairs from case-data-item blocks
    # Pattern: case-data-item > case-data-label>LABEL< ... case-title-data[...]>VALUE<
    # The case-title-data div may have additional classes like summary-status
    item_pattern = r'class="case-data-item">\s*<div class="case-data-label">([^<]+)</div>\s*(?:<a[^>]*>\s*)?<div class="case-title-data[^"]*">([^<]+)'
    for label, value in re.findall(item_pattern, html, re.DOTALL):
        result[label.strip()] = unescape(re.sub(r"<[^>]+>", "", value).strip())

    # Status badge (fallback if not caught by the item pattern)
    if "status" not in result:
        status_match = re.search(
            r'">(Open for Claims|Preliminarily Approved|'
            r'Pending Final Approval|Settlement Approved|'
            r'Pending Court Approval|Paid)<',
            html,
        )
        if status_match:
            result["status"] = status_match.group(1)

    # Category from tn-category divs on the detail page
    if "category" not in result:
        cat_match = re.search(r'tn-category">([^<]+)', html)
        if cat_match:
            result["category"] = cat_match.group(1).strip()

    # Days remaining — extracted from "Days Remaining to file Claim" field or text pattern
    if "Days Remaining to file Claim" in result:
        try:
            result["days_left"] = int(result["Days Remaining to file Claim"])
        except ValueError:
            pass

    # Fallback: look for "X Days left" text pattern
    if "days_left" not in result:
        days_match = re.search(r"(\d+)\s*Days?\s*left", html, re.IGNORECASE)
        if days_match:
            result["days_left"] = int(days_match.group(1))

    return result


def main():
    print("[1/4] Fetching RSS feed...")
    rss_html = fetch_url(CLAIMDEPOT_RSS)
    if not rss_html:
        print("[FATAL] Could not fetch RSS feed", file=sys.stderr)
        sys.exit(1)

    print("[2/4] Parsing RSS items...")
    settlements = parse_rss(rss_html)
    print(f"  Found {len(settlements)} settlements in RSS feed")

    print("[3/4] Fetching listings page for category data...")
    listings_html = fetch_url(CLAIMDEPOT_LISTINGS)
    listings_categories = {}
    if listings_html:
        listings_categories = extract_listing_categories(listings_html)
        print(f"  Found {len(listings_categories)} category entries on listings page")

    print(f"[4/4] Fetching detail pages for {len(settlements)} settlements...")
    for i, s in enumerate(settlements):
        if (i + 1) % 20 == 0:
            print(f"  Processing {i+1}/{len(settlements)}...")

        if s["slug"] in listings_categories:
            s["category"] = listings_categories[s["slug"]]

        detail_html = fetch_url(s["claimUrl"])
        if detail_html:
            detail = parse_detail_page(detail_html)
            if detail.get("Status"):
                s["status"] = detail["Status"]
            if detail.get("Claim Deadline"):
                s["deadline"] = detail["Claim Deadline"]
            if detail.get("days_left"):
                s["daysLeft"] = detail["days_left"]
            # Category comes from Case Data page as "Category" key
            if detail.get("Category") and not s.get("category"):
                s["category"] = detail["Category"]
            elif detail.get("category") and not s.get("category"):
                s["category"] = detail["category"]
            if detail.get("Settlement Amount"):
                s["settlementAmount"] = detail["Settlement Amount"]
            if detail.get("Estimated Payout per person"):
                s["estimatedAmount"] = detail["Estimated Payout per person"]
            if detail.get("Case Number"):
                s["caseNumber"] = detail["Case Number"]
            if detail.get("Case Title"):
                s["caseTitle"] = detail["Case Title"]
            if detail.get("Settlement Website"):
                s["settlementWebsite"] = detail["Settlement Website"]
            if detail.get("Settlement Administrator"):
                s["administrator"] = detail["Settlement Administrator"]
            if detail.get("Court"):
                s["court"] = detail["Court"]
            if detail.get("Jurisdiction"):
                s["jurisdiction"] = detail["Jurisdiction"]
            if detail.get("Fairness Hearing"):
                s["fairnessHearing"] = detail["Fairness Hearing"]
            if detail.get("Final Approval Hearing"):
                s["finalApprovalHearing"] = detail["Final Approval Hearing"]
            if detail.get("Is Proof Required?"):
                s["proofRequired"] = detail["Is Proof Required?"]

        s["source"] = "claimdepot"
        s["lastSeenAt"] = datetime.now(timezone.utc).isoformat()

    output = {
        "lastUpdated": datetime.now(timezone.utc).isoformat(),
        "source": "claimdepot.com",
        "total": len(settlements),
        "settlements": settlements,
    }

    output_path = os.path.normpath(OUTPUT_PATH)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\n✅ Done! Wrote {len(settlements)} settlements to {output_path}")
    print(f"   Last updated: {output['lastUpdated']}")
    cats = sorted(set(s.get("category", "?") for s in settlements))
    print(f"   Categories: {cats}")


if __name__ == "__main__":
    main()
