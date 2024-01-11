import argparse
from xml.etree import ElementTree as ET

def read_xml(xml_file):
    tree = ET.parse(xml_file)
    root = tree.getroot()
    return root

def read_csv(csv_file):
    with open(csv_file, 'r', encoding='utf-8') as file:
        # Split URLs by lines and remove leading/trailing whitespaces
        return [line.strip() for line in file.read().splitlines()]


def append_urls_to_sitemap(xml_root, new_urls):
    for new_url in new_urls:
        if new_url not in [loc.text for loc in xml_root.findall(".//{http://www.sitemaps.org/schemas/sitemap/0.9}loc")]:
            url_element = ET.Element("{http://www.sitemaps.org/schemas/sitemap/0.9}url")
            loc_element = ET.SubElement(url_element, "{http://www.sitemaps.org/schemas/sitemap/0.9}loc")
            loc_element.text = f"{new_url}\n"  # Append a newline character to the URL
            xml_root.append(url_element)


def write_sitemap(output_file, xml_root):
    tree = ET.ElementTree(xml_root)
    tree.write(output_file, encoding='utf-8', xml_declaration=True, method="xml")


def combine_xml_csv(xml_sitemap, new_csv, output_file):
    xml_root = read_xml(xml_sitemap)
    new_urls = read_csv(new_csv)
    append_urls_to_sitemap(xml_root, new_urls)
    write_sitemap(output_file, xml_root)

def main():
    parser = argparse.ArgumentParser(description='Combine existing sitemap.xml with new URLs from a CSV file.')
    parser.add_argument('-x', '--xml_sitemap', required=True, help='Path to the existing sitemap.xml file.')
    parser.add_argument('-c', '--new_csv', required=True, help='Path to the CSV file containing new URLs.')
    parser.add_argument('-o', '--output_file', required=True, help='Path to the output sitemap.xml file.')

    args = parser.parse_args()

    combine_xml_csv(args.xml_sitemap, args.new_csv, args.output_file)
    print(f"Combined sitemap saved to {args.output_file}")

if __name__ == '__main__':
    main()
