import requests
import csv
import argparse
from urllib.parse import urlparse, urlunparse
from datetime import datetime

def normalize_url(url):
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url  # Default to https if no scheme is present
    parsed = urlparse(url)
    if parsed.netloc.startswith('www.'):
        netloc = parsed.netloc[4:]
    else:
        netloc = parsed.netloc
    return urlunparse(parsed._replace(netloc=netloc, scheme='https'))

def should_include_url(url, excluded_extensions):
    return not any(url.endswith(ext) for ext in excluded_extensions)

def crawl_url(url):
    try:
        response = requests.get(url, allow_redirects=True, timeout=5)
        if response.history:
            final_url = response.url
            return final_url, url, final_url != url
        if response.status_code == 200:
            return url, None, False
    except requests.RequestException as e:
        print(f"Invalid URL: {url} - Error: {e}")
    return None, None, False

def process_urls(input_file, excluded_extensions):
    with open(input_file, 'r') as file:
        reader = csv.reader(file)
        urls = set()
        for row in reader:
            for url in row:
                normalized = normalize_url(url)
                if should_include_url(normalized, excluded_extensions):
                    urls.add(normalized)
        return urls

def main():
    parser = argparse.ArgumentParser(description='Remove duplicate and not useful URLs and verify that the URLs work')
    parser.add_argument('-c', '--csv', required=True, help='CSV list of URLs.')
    parser.add_argument('-o', '--output', required=False, help='Path to the output URL.csv')
    args = parser.parse_args()

    excluded_extensions = ['.asp', '.aspx', '.ashx', '.css', '.png', '.json', '.pdf', '.txt', '.js', '.php', '.svg', '.woff2', '.woff', '.ttf', '.eot', '.ico', '.esi', '.gif', '.jpg', '.html', '.rss', '.zip', '.doc', '.docx']
    urls_to_crawl = process_urls(args.csv, excluded_extensions)

    final_urls = set()
    for url in urls_to_crawl:
        resolved_url, original_url, is_redirected = crawl_url(url)
        if resolved_url:
            final_urls.add(resolved_url)
            if is_redirected:
                print(f"Redirected URL: Original: {original_url}, Final: {resolved_url}")

    output_file = args.output
    if not output_file:
        second_url = list(urls_to_crawl)[1]
        domain = urlparse(second_url).netloc
        today = datetime.today().strftime('%d%m%Y')
        output_file = f"{domain}-{today}.csv"

    with open(output_file, 'w', newline='') as file:
        writer = csv.writer(file)
        for url in final_urls:
            writer.writerow([url])

if __name__ == '__main__':
    main()
