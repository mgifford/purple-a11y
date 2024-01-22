import requests
import csv
import argparse
from urllib.parse import urlparse
from xml.etree import ElementTree as ET
from collections import Counter

# Define a global count variable to keep track of checked URLs
url_check_count = 0

# Define a list to store failed URLs
failed_urls = []

# Dictionary to store the final URLs after following redirects
final_urls = {}

def is_valid_url(url):
    global url_check_count  # Declare the global count variable

    url_check_count += 1  # Increment the count for each URL checked
    print(f"Checking URL {url_check_count}: {url}")

    try:
        response = requests.head(url, timeout=5, allow_redirects=True)  # Follow redirects
        if response.status_code == 200:
            # Store the final URL after following redirects
            final_url = response.url
            final_urls[url] = final_url
            if url != final_url:
                print(f"Redirect: {url} -> {final_url}")  # Print the redirect
            return True
        else:
            return False
    except (requests.exceptions.Timeout, requests.exceptions.RequestException) as e:
        print(f"Error checking URL {url}: {e}")
        return False

def preprocess_url(url):
    # print(f"preprocess_url? {url}")
    
    # List of URL prefixes to try
    url_prefixes = ["https://www.", "https://", "http://www.", "http://"]
    
    for prefix in url_prefixes:
        modified_url = prefix + url
        if is_valid_url(modified_url):
            return final_urls[modified_url]  # Return the final URL after redirects
        else:
            failed_urls.append(modified_url)  # Add failed URL to the list
    
    return url  # If none of the prefixes worked, return the original URL

def read_csv(csv_file):
    print(f"read_csv? {csv_file}")
    with open(csv_file, 'r', encoding='utf-8') as file:
        reader = csv.reader(file)
        return [row[0].strip() for row in reader]

def generate_sitemap(urls, output_file):
    print(f"generate_sitemap? {urls}")
    root = ET.Element("urlset", xmlns="http://www.sitemaps.org/schemas/sitemap/0.9")
    
    for url in urls:
        # Check for ".pdf" or ".xml" in the URL and skip if found
        if ".pdf" in url or ".xml" in url:
            print(f"Skipping URL with '.pdf' or '.xml': {url}")
            continue
        
        url_element = ET.SubElement(root, "url")
        loc_element = ET.SubElement(url_element, "loc")
        loc_element.text = url
    
    # Use minidom to pretty-print the XML with line breaks
    from xml.dom import minidom
    xml_str = minidom.parseString(ET.tostring(root)).toprettyxml(indent="  ")

    with open(output_file, 'w', encoding='utf-8') as file:
        file.write(xml_str)

def check_duplicates(output_file):
    with open(output_file, 'r', encoding='utf-8') as file:
        lines = file.readlines()
        url_counts = Counter(lines)
    
    duplicate_urls = [url for url, count in url_counts.items() if count > 1]
    if duplicate_urls:
        print("\nDuplicate URLs found in the output file:")
        for url in duplicate_urls:
            print(url.strip())

def main():
    parser = argparse.ArgumentParser(description='Verify URLs and generate sitemap.xml.')
    parser.add_argument('-c', '--csv_file', required=True, help='Path to the CSV file containing URLs.')
    parser.add_argument('-o', '--output_file', required=True, help='Path to the output sitemap.xml file.')

    args = parser.parse_args()

    urls = [preprocess_url(url) for url in read_csv(args.csv_file)]
    valid_urls = [url for url in urls if is_valid_url(url)]

    if not valid_urls:
        print("No valid URLs found. Exiting.")
        return

    generate_sitemap(valid_urls, args.output_file)
    print(f"Sitemap generated with {len(valid_urls)} valid URLs. Saved to {args.output_file}")

    # Print failed URLs
    if failed_urls:
        print("\nFailed to load URLs:")
        for failed_url in failed_urls:
            print(failed_url)

    # Check for duplicates in the output file
    check_duplicates(args.output_file)

if __name__ == '__main__':
    main()
