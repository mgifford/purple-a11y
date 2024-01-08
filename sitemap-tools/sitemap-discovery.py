#
# Sitemap Discover
# 
# python sitemap-discovery.py
# Pulls a list of domain names from "domain_source.csv" and then saves successfully discovered sitemaps to "sitemap_extracts.csv" 
# and also includes a list of failures "sitemap_failures.csv" for manual inspection.
#

import csv
import requests
from urllib.parse import urljoin, urlparse, urlunparse
from bs4 import BeautifulSoup
from lxml import etree

def is_valid_sitemap(xml_content):
    try:
        schema_url = "http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd"
        schema = etree.XMLSchema(etree.XML(requests.get(schema_url).content))
        root = etree.fromstring(xml_content)
        return schema.validate(root)
    except etree.XMLSchemaError:
        return False

def get_valid_domains(domains):
    valid_domains = set()
    failed_domains = set()

    for domain in domains:
        try:
            # Step 1: Check if the main page loads
            response = requests.get(domain, timeout=5)
            if response.status_code == 200:
                # Step 2: Check for sitemap.xml
                sitemap_url = urljoin(response.url, '/sitemap.xml')
                sitemap_response = requests.get(sitemap_url, timeout=5)
                if sitemap_response.status_code == 200 and is_valid_sitemap(sitemap_response.content):
                    valid_domains.add(sitemap_url)
                else:
                    valid_domains.add(urlunparse(urlparse(response.url)._replace(path='', query='', fragment='')))
                    failed_domains.add(domain)  # Add the main domain to failures if sitemap is not found or not valid

        except requests.RequestException as e:
            print(f"Error processing domain {domain}: {e}")
            failed_domains.add(domain)

    return valid_domains, failed_domains

def read_domains_from_csv(file_path):
    domains = set()
    with open(file_path, 'r', encoding='utf-8') as csvfile:
        reader = csv.reader(csvfile)
        for row in reader:
            if row:  # Check if the row is not empty
                domains.add(row[0])
    return domains

def write_domains_to_csv(file_path, domains):
    with open(file_path, 'w', encoding='utf-8', newline='') as csvfile:
        writer = csv.writer(csvfile)
        for domain in domains:
            writer.writerow([domain])

if __name__ == "__main__":
    input_domains = read_domains_from_csv("domain_source.csv")
    unique_valid_domains, failed_domains = get_valid_domains(input_domains)
    
    write_domains_to_csv("sitemap_extracts.csv", unique_valid_domains)
    write_domains_to_csv("sitemap_failures.csv", failed_domains)

    print("Domains with sitemaps:")
    for domain in unique_valid_domains:
        print(domain)

    print("\nDomains without sitemaps:")
    for domain in failed_domains:
        print(domain)
