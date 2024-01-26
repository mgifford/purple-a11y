import requests
import xml.etree.ElementTree as ET
from datetime import datetime
import os
import argparse

def get_final_url_and_mime_type(url):
    try:
        response = requests.get(url, allow_redirects=True)
        final_url = response.url
        mime_type = response.headers.get('Content-Type', '')
        return final_url, mime_type, response.status_code
    except requests.RequestException as e:
        print(f"Error accessing {url}: {e}")
        return url, None, None

def update_sitemap(sitemap_file):
    tree = ET.parse(sitemap_file)
    root = tree.getroot()
    unique_urls = set()
    original_url_count = 0
    updated_url_count = 0
    changes_made = False

    for url_element in root.findall('.//{http://www.sitemaps.org/schemas/sitemap/0.9}url'):
        loc_element = url_element.find('{http://www.sitemaps.org/schemas/sitemap/0.9}loc')
        original_url = loc_element.text
        original_url_count += 1

        final_url, mime_type, status_code = get_final_url_and_mime_type(original_url)

        if original_url in unique_urls or mime_type is None or 'text/html' not in mime_type or status_code != 200:
            root.remove(url_element)
            changes_made = True
            continue

        print(f"Adding {final_url}")
        unique_urls.add(final_url)
        updated_url_count += 1

    if changes_made:
        # Backup the original file
        backup_filename = f"{os.path.splitext(sitemap_file)[0]}-{datetime.now().strftime('%d%b%Y')}.xml"
        tree.write(backup_filename)

        # Manually create sitemap content
        sitemap_content = '<?xml version="1.0" encoding="UTF-8"?>\n'
        sitemap_content += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        for url in unique_urls:
            sitemap_content += f'  <url><loc>{url}</loc></url>\n'
        sitemap_content += '</urlset>'

        # Write the manually created sitemap to the file
        with open(sitemap_file, 'w', encoding='utf-8') as file:
            file.write(sitemap_content)

        print(f"Original URL Count: {original_url_count}")
        print(f"Updated URL Count (excluding duplicates and invalid): {updated_url_count}")
        print(f"Changes made. Original file backed up as {backup_filename}")
    else:
        print("No changes made to the sitemap.")

def main():
    parser = argparse.ArgumentParser(description="Update sitemap file with valid URLs.")
    parser.add_argument('-x', '--sitemap', required=True, help='Path to the sitemap file.')
    args = parser.parse_args()
    update_sitemap(args.sitemap)

if __name__ == '__main__':
    main()
