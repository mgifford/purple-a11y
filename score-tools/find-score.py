import os
import csv
from collections import defaultdict
from datetime import datetime
import argparse
from urllib.parse import urlparse

def get_domain_from_csv(csv_file):
    if not os.path.exists(csv_file):
        print(f"File not found: {csv_file}")
        return "unknown_domain"

    with open(csv_file, 'r', encoding='utf-8') as file:
        reader = csv.reader(file)
        next(reader)  # Skip header row
        first_row = next(reader, None)
        if first_row:
            url = first_row[4]
            parsed_url = urlparse(url)
            return parsed_url.netloc.replace('.', '_')

def get_unique_urls(csv_file):
    unique_urls = set()
    with open(csv_file, 'r', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        for row in reader:
            unique_urls.add(row['url'])
    return unique_urls

def update_summary(summary, report_directory):
    report_file = os.path.join(report_directory, 'report.csv')
    with open(report_file, 'r', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        for row in reader:
            for key, value in row.items():
                summary[key][value] += 1

def save_summary_to_file(output_filename, values, output_directory):
    output_path = os.path.join(output_directory, output_filename)
    with open(output_path, 'w', encoding='utf-8', newline='') as output_file:
        csv_writer = csv.writer(output_file)
        for key, value in values.items():
            csv_writer.writerow([key, value])

def save_urls_to_file(output_filename, count, output_directory):
    output_path = os.path.join(output_directory, output_filename)
    with open(output_path, 'w', encoding='utf-8', newline='') as output_file:
        csv_writer = csv.writer(output_file)
        csv_writer.writerow([count])


def find_and_parse_reports(directory, partial_string, output_directory):
    for subdir in os.listdir(directory):
        subdir_path = os.path.join(directory, subdir)
        if os.path.isdir(subdir_path) and partial_string in subdir:
            report_directory = os.path.join(subdir_path, 'reports')
            report_file = os.path.join(report_directory, 'report.csv')

            if os.path.exists(report_file):
                domain = get_domain_from_csv(report_file)
                timestamp = subdir.split('_')[0]
                output_filename_base = f"{domain}_{timestamp}"

                summary = defaultdict(lambda: defaultdict(int))
                unique_urls = set()
                print(f"Building report for {subdir_path}")

                try:
                    update_summary(summary, report_directory)
                    unique_urls.update(get_unique_urls(report_file))

                    for column, values in summary.items():
                        output_filename = f"{output_filename_base}_{column}.csv"
                        save_summary_to_file(output_filename, values, output_directory)

                    output_filename_urls = f"{output_filename_base}_number_urls.csv"
                    save_urls_to_file(output_filename_urls, len(unique_urls), output_directory)
                except FileNotFoundError as e:
                    print(f"Skipping directory {subdir} due to missing file: {e}")
                    continue
            else:
                print(f"No report found for {subdir_path}")

def main():
    parser = argparse.ArgumentParser(description='Find and parse reports.')
    parser.add_argument('-d', '--directory', default='./', help='Directory to scan (default: current directory)')
    parser.add_argument('-p', '--partial-string', default=datetime.today().strftime('%Y%m%d'), help='Partial string to search for (default: today\'s date)')
    parser.add_argument('-o', '--output', default='./', help='Output directory for files (default: current directory)')
    args = parser.parse_args()

    find_and_parse_reports(args.directory, args.partial_string, args.output)

if __name__ == "__main__":
    main()
