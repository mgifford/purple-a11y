#
# Sitemap Randomizer
# 
# Runn this script with some basic parameters. -u URL, -n number of urls, -f format for exported file. 
# python sitemap-randomizer.py -u https://whitehouse.gov/sitemap.xml -n 2000 -f xml
#

import requests
import random
import argparse
import os
from urllib.parse import urlparse
from lxml import etree
from io import BytesIO
import csv
from datetime import datetime

def get_sitemap_urls(url):
    try:
        response = requests.get(url)
        response.raise_for_status()
        xml_content = BytesIO(response.content)
        
        tree = etree.parse(xml_content)
        root = tree.getroot()

        # Assuming the URLs are in <loc> tags
        urls = [element.text for element in root.findall(".//{http://www.sitemaps.org/schemas/sitemap/0.9}loc")]

        # Look for additional sitemap files and parse them recursively
        for sitemap in root.findall(".//{http://www.sitemaps.org/schemas/sitemap/0.9}sitemap"):
            sitemap_url = sitemap.find("{http://www.sitemaps.org/schemas/sitemap/0.9}loc").text
            urls.extend(get_sitemap_urls(sitemap_url))

        return urls

    except requests.exceptions.RequestException as e:
        print(f"Error fetching sitemap: {e}")
        return []

def filter_and_randomize_urls(urls, exclude_strings, include_strings):
    excluded_extensions = ['pdf', 'zip', 'txt', 'pptx', '.pdf', '.pdf-0', '.doc', '.docx-0', '.docx', '.docx-0', '.xls', '.xls-0', '.xlsx', '.xlsx-0', '.ppt', '.ppt-0', '.pptx', '.pptx-0', '.rss', '.xml', '.zip', '.zip-0', '.zip-1', '.txt']
    
    filtered_urls = [
        url for url in urls
        if not any(url.endswith(ext) for ext in excluded_extensions) and not any(es in url for es in exclude_strings)
    ]

    # Include URLs that match the specified strings
    if include_strings:
        filtered_urls = [url for url in filtered_urls if any(es in url for es in include_strings)]
    
    random.shuffle(filtered_urls)
    return filtered_urls

def save_urls_to_xml(urls, filename):
    with open(filename, 'w', encoding='utf-8') as file:
        file.write('<?xml version="1.0" encoding="UTF-8"?>\n')
        file.write('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
        for url in urls:
            file.write(f'  <url><loc>{url}</loc></url>\n')
        file.write('</urlset>\n')

def save_urls_to_csv(urls, filename):
    with open(filename, 'w', newline='', encoding='utf-8') as file:
        writer = csv.writer(file)
        for url in urls:
            writer.writerow([url])

def main():
    parser = argparse.ArgumentParser(description='Randomize and filter URLs from a sitemap.')
    parser.add_argument('-u', '--url', required=True, help='The URL of the sitemap.')
    parser.add_argument('-n', '--number', type=int, default=2000, help='The number of URLs to retrieve (default: 2000).')
    parser.add_argument('-e', '--exclude', nargs='+', default=[], help='Strings to exclude from URLs.')
    parser.add_argument('-i', '--include', nargs='+', default=[], help='Strings to force inclusion from URLs.')
    parser.add_argument('-f', '--format', choices=['xml', 'csv'], default='xml', help='Output format (default: xml).')
    parser.add_argument('-o', '--output', required=True, help='Output filename with path.')

    args = parser.parse_args()

    urls = get_sitemap_urls(args.url)
    filtered_urls = filter_and_randomize_urls(urls, args.exclude, args.include)[:args.number]

    # Use the specified output filename
    output_filename = args.output

    if args.format == 'xml':
        save_urls_to_xml(filtered_urls, output_filename)
    elif args.format == 'csv':
        save_urls_to_csv(filtered_urls, output_filename)

    print(f"Output saved to {output_filename}")

if __name__ == '__main__':
    main()
