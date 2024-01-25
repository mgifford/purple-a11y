import argparse
from xml.etree import ElementTree as ET
import xml.dom.minidom

def read_xml(xml_file):
    tree = ET.parse(xml_file)
    root = tree.getroot()
    return root

def read_csv(csv_file):
    with open(csv_file, 'r', encoding='utf-8') as file:
        return [line.strip() for line in file.read().splitlines()]

def append_urls_to_sitemap(xml_root, new_urls):
    for new_url in new_urls:
        if new_url not in [loc.text for loc in xml_root.findall(".//{http://www.sitemaps.org/schemas/sitemap/0.9}loc")]:
            url_element = ET.SubElement(xml_root, "url")
            loc_element = ET.SubElement(url_element, "loc")
            loc_element.text = new_url

def write_sitemap(output_file, xml_root):
    tree = ET.ElementTree(xml_root)

    # Convert the ElementTree to a string and then parse it with minidom for pretty printing
    xml_string = ET.tostring(tree.getroot(), encoding='unicode')
    dom = xml.dom.minidom.parseString(xml_string)

    # Get the pretty printed string with proper indentation and line breaks
    pretty_xml_as_string = dom.toprettyxml(indent="    ")

    # Write the pretty printed XML to the file
    with open(output_file, 'w', encoding='utf-8') as file:
        file.write(pretty_xml_as_string)

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
