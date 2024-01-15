import requests
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
from urllib.robotparser import RobotFileParser
import argparse
import xml.etree.ElementTree as ET
from xml.dom import minidom

# Define a global count variable to keep track of checked URLs
url_check_count = 0

def is_same_domain(url, domain):
    return urlparse(url).netloc == domain

def can_fetch(robots_parser, url):
    global url_check_count  # Declare the global count variable
    url_check_count += 1  # Increment the count for each URL checked
    print(f"Found URL {url_check_count}: {url}")
    return robots_parser.can_fetch('*', url)

def is_html(response):
    content_type = response.headers.get('Content-Type', '')
    return 'text/html' in content_type

def clean_url(url):
    parsed_url = urlparse(url)
    clean_url = parsed_url.scheme + "://" + parsed_url.netloc + parsed_url.path
    # Skip URLs with specific fragments
    if parsed_url.fragment in ['main-content', 'footer--section']:
        return None
    return clean_url


def crawl_site(start_url):
    visited = set()
    urls_to_visit = {start_url}
    unique_urls = set()
    domain = urlparse(start_url).netloc

    robots_url = f'http://{domain}/robots.txt'
    robots_parser = RobotFileParser()
    robots_parser.set_url(robots_url)
    robots_parser.read()

    while urls_to_visit:
        current_url = urls_to_visit.pop()
        visited.add(current_url)

        if not can_fetch(robots_parser, current_url):
            continue

        cleaned_url = clean_url(current_url)
        if cleaned_url and cleaned_url not in unique_urls:
            unique_urls.add(cleaned_url)

            try:
                response = requests.get(cleaned_url, timeout=5)
                if response.status_code != 200 or not is_html(response):
                    continue

                soup = BeautifulSoup(response.content, 'html.parser')

                for link in soup.find_all('a', href=True):
                    href = link['href']
                    full_url = urljoin(cleaned_url, href)
                    if is_same_domain(full_url, domain) and full_url not in visited and full_url not in urls_to_visit:
                        urls_to_visit.add(full_url)

            except requests.RequestException:
                continue

    return unique_urls


def generate_sitemap(urls, output_file):
    root = ET.Element("urlset", xmlns="http://www.sitemaps.org/schemas/sitemap/0.9")

    for url in urls:
        if ".pdf" in url or ".xml" in url:
            continue
        
        url_element = ET.SubElement(root, "url")
        loc_element = ET.SubElement(url_element, "loc")
        loc_element.text = url

    xml_str = minidom.parseString(ET.tostring(root)).toprettyxml(indent="  ")

    with open(output_file, 'w', encoding='utf-8') as file:
        file.write(xml_str)

def main():
    parser = argparse.ArgumentParser(description='Crawl URLs and generate sitemap.xml.')
    parser.add_argument('-s', '--site_url', required=True, help='Site to start crawling.')
    parser.add_argument('-o', '--output_file', required=True, help='Path to the output sitemap.xml file.')
    
    args = parser.parse_args()

    urls = crawl_site(args.site_url)
    generate_sitemap(urls, args.output_file)
    print(f"Sitemap generated with {len(urls)} unique URLs. Saved to {args.output_file}.")

if __name__ == '__main__':
    main()
