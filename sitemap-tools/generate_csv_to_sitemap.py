import requests
import csv
import argparse
from urllib.parse import urlparse
from xml.etree import ElementTree as ET

# Define a global count variable to keep track of checked URLs
url_check_count = 0

def is_valid_url(url):
    global url_check_count  # Declare the global count variable

    url_check_count += 1  # Increment the count for each URL checked
    print(f"Checking URL {url_check_count}: {url}")

    try:
        response = requests.head(url, timeout=5)  # Timeout of 5 seconds
        return response.status_code == 200
    except (requests.exceptions.Timeout, requests.exceptions.RequestException) as e:
        print(f"Error checking URL {url}: {e}")
        return False

def preprocess_url(url):
    print(f"preprocess_url? {url}")
    
    # List of URL prefixes to try
    url_prefixes = ["https://www.", "https://", "http://www.", "http://"]
    
    for prefix in url_prefixes:
        modified_url = prefix + url
        if is_valid_url(modified_url):
            return modified_url  # Return the modified URL if it's valid
        else:
            print(f"Failed to load URL with prefix {prefix}: {modified_url}")
    
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
        url_element = ET.SubElement(root, "url")
        loc_element = ET.SubElement(url_element, "loc")
        loc_element.text = url
    
    # Use minidom to pretty-print the XML with line breaks
    from xml.dom import minidom
    xml_str = minidom.parseString(ET.tostring(root)).toprettyxml(indent="  ")

    with open(output_file, 'w', encoding='utf-8') as file:
        file.write(xml_str)

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

if __name__ == '__main__':
    main()
