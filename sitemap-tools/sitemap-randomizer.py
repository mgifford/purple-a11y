#
# Sitemap Randomizer
# 
# Run this script with some basic parameters. -u URL, -n number of urls, -f format for exported file. 
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
import hashlib

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

def filter_and_randomize_urls(urls, exclude_strings, include_strings, percentage):
    excluded_extensions = ['pdf', 'zip', 'txt', 'pptx', '.pdf', '.pdf-0', '.doc', '.docx-0', '.docx', '.docx-0', '.xls', '.xls-0', '.xlsx', '.xlsx-0', '.ppt', '.ppt-0', '.pptx', '.pptx-0', '.rss', '.xml', '.zip', '.zip-0', '.zip-1', '.txt']

    # Filter URLs based on excluded extensions and strings
    filtered_urls = [
        url for url in urls
        if not any(url.endswith(ext) for ext in excluded_extensions) and not any(es in url for es in exclude_strings)
    ]


    # Include URLs that match the specified strings
    if include_strings:
        filtered_urls = [url for url in filtered_urls if any(es in url for es in include_strings)]

    # Filter URLs based on the hash percentage
    percent_range = int(percentage / 10)
    allowed_starts = [str(i) for i in range(percent_range)]

    def get_hash(url):
        return hashlib.md5(url.encode()).hexdigest()

    filtered_by_hash = [
        url for url in filtered_urls
        if get_hash(url)[0] in allowed_starts
    ]
    
    return filtered_by_hash

def get_hash(url):
    hash_object = hashlib.md5(url.encode())
    return hash_object.hexdigest()

# Using the hash is a good way to ensure that mostly the same URLs are being scanned. 
# Unlike a random script, this will consistently pull up mostly the same results, 
# and they will be random
def filter_by_hash_percentage(hashed_urls, percentage):
    max_first_digit = percentage // 10
    return [url for url, hash_value in hashed_urls if int(hash_value[0], 16) < max_first_digit]


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
    parser.add_argument('-p', '--percentage', type=int, choices=[10, 20, 30, 40, 50], default=10, help='Percentage of URLs to return (default: 10).')
    args = parser.parse_args()

    urls = get_sitemap_urls(args.url)
    filtered_urls = filter_and_randomize_urls(urls, args.exclude, args.include, args.percentage)[:args.number]

    # Use the specified output filename
    output_filename = args.output

    if args.format == 'xml':
        save_urls_to_xml(filtered_urls, output_filename)
    elif args.format == 'csv':
        save_urls_to_csv(filtered_urls, output_filename)

    print(f"Output saved to {output_filename}")

if __name__ == '__main__':
    main()
