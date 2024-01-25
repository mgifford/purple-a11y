import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse, urlunparse
from urllib.robotparser import RobotFileParser
import xml.etree.ElementTree as ET
import argparse
from datetime import datetime

def can_fetch(url, user_agent='*'):
    parsed_url = urlparse(url)
    robots_url = f"{parsed_url.scheme}://{parsed_url.netloc}/robots.txt"
    rp = RobotFileParser()
    rp.set_url(robots_url)
    rp.read()
    return rp.can_fetch(user_agent, url)

def get_links(url, domain):
    page_links = set()
    try:
        response = requests.get(url, timeout=5)
        soup = BeautifulSoup(response.content, "html.parser")
        for link in soup.find_all("a", href=True):
            href = urljoin(url, link['href'])
            if urlparse(href).netloc == domain:
                page_links.add(normalize_url(href))
    except requests.RequestException:
        pass
    return page_links

def normalize_url(url):
    parsed_url = urlparse(url)
    return urlunparse((parsed_url.scheme, parsed_url.netloc, parsed_url.path, '', '', ''))

def crawl_website(start_url):
    domain = urlparse(start_url).netloc
    visited_urls = set()
    urls_to_visit = {start_url}
    all_links = set()

    while urls_to_visit:
        current_url = urls_to_visit.pop()
        if current_url not in visited_urls and can_fetch(current_url):
            visited_urls.add(current_url)

            # print(f"New URL found: {current_url}")  # Echo new URL to terminal

            found_links = get_links(current_url, domain)
            new_links = found_links - all_links
            for link in new_links:
                print(f"Adding new link to sitemap: {link}")  # Echo new link to terminal
            all_links.update(new_links)
            urls_to_visit.update(new_links - visited_urls)
        else:
            print(f"Duplicate or inaccessible URL skipped: {current_url}")  # Echo duplicate URL to terminal

    return all_links

def create_sitemap(urls, output_file):
    lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for url in urls:
        if not url.endswith(('.pdf', '.xml', '.txt', '.json', '.doc', '.docx')):
            lines.append(f'    <url><loc>{url}</loc></url>')

    lines.append('</urlset>')

    formatted_xml = '\n'.join(lines)
    with open(output_file, 'w', encoding='utf-8') as file:
        file.write(formatted_xml)

def format_xml(xml_content):
    """Formats the XML string with proper indentation and line breaks."""
    lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for line in xml_content.splitlines():
        if line.strip().startswith('<url>'):
            lines.append('  ' + line.strip())
        elif line.strip().startswith('<loc>'):
            lines.append('    ' + line.strip())
        elif line.strip().startswith('</url>'):
            lines.append('  ' + line.strip())
    lines.append('</urlset>')
    return '\n'.join(lines)

def main(domain):
    domain_name = domain if urlparse(domain).scheme else f"http://{domain}"
    today_date = datetime.now().strftime('%Y%m%d')
    output_file = f"{domain}_sitemap_{today_date}.xml"
    urls = crawl_website(domain_name)
    create_sitemap(urls, output_file)
    print(f"Sitemap for {domain} created as {output_file}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Crawl a website and create a sitemap.')
    parser.add_argument('-d', '--domain', required=True, help='Domain to crawl and create a sitemap for.')
    args = parser.parse_args()
    main(args.domain)
