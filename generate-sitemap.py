#!/usr/bin/env python3
"""
Generate sitemap.xml for this static site.

Usage:
  python3 generate-sitemap.py https://example.com

If your site is hosted in a subfolder (GitHub Pages project site), use:
  python3 generate-sitemap.py https://username.github.io/repo
"""
from __future__ import annotations
import sys
from pathlib import Path
from urllib.parse import urljoin
from datetime import date

def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python3 generate-sitemap.py <BASE_URL>")
        return 1

    base = sys.argv[1].rstrip("/") + "/"
    root = Path(__file__).resolve().parent

    html_files = sorted(p.relative_to(root).as_posix() for p in root.rglob("*.html"))

    ordered: list[str] = []
    if "index.html" in html_files:
        ordered.append("")  # root
        html_files.remove("index.html")
    ordered.extend(html_files)

    lastmod = date.today().isoformat()
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']

    for rel in ordered:
        loc = base if rel == "" else urljoin(base, rel)
        lines.append("  <url>")
        lines.append(f"    <loc>{loc}</loc>")
        lines.append(f"    <lastmod>{lastmod}</lastmod>")
        lines.append("  </url>")

    lines.append("</urlset>")
    (root / "sitemap.xml").write_text("\n".join(lines), encoding="utf-8")
    print("✅ sitemap.xml generated for:", base)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
