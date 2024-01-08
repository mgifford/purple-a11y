# 
# Find Score
# 
# Aggregate a list of purple hats axe scores by looking at the reports.csv files
# Run in directory with output of the Purple A11y reports.
#

import os
import csv
from collections import defaultdict
from datetime import datetime
import argparse

def find_and_parse_reports(directory, partial_string):
    for subdir in os.listdir(directory):
        if os.path.isdir(os.path.join(directory, subdir)) and partial_string in subdir:
            report_directory = os.path.join(directory, subdir, 'reports')
            if os.path.exists(report_directory):
                domain = get_domain_from_csv(os.path.join(report_directory, 'report.csv'))
                timestamp = subdir.split('_')[0]
                output_filename_base = f"{domain}_{timestamp}"

                # Process the report and update the summary
                summary = defaultdict(lambda: defaultdict(int))
                unique_urls = set()
                update_summary(summary, report_directory)

                # Process unique URLs
                unique_urls.update(get_unique_urls(os.path.join(report_directory, 'report.csv')))

                # Save individual column summaries to text files
                for column, values in summary.items():
                    output_filename = f"{output_filename_base}_{column}.txt"
                    save_summary_to_file(output_filename, values)

                # Save the total number of unique URLs to a text file
                output_filename_urls = f"{output_filename_base}_number_urls.txt"
                save_urls_to_file(output_filename_urls, len(unique_urls))

def get_domain_from_csv(csv_file):
    with open(csv_file, 'r', encoding='utf-8') as file:
        reader = csv.reader(file)
        next(reader)  # Skip header row
        first_row = next(reader, None)
        if first_row:
            url = first_row[4]
            return extract_domain(url)
    return "unknown_domain"

def extract_domain(url):
    # Extract the domain name from the URL
    return url.split('/')[2].replace('.', '_')

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


def save_summary_to_file(output_filename, values):
    csv_filename = output_filename.replace('.txt', '.csv')  # Change file extension to CSV
    with open(csv_filename, 'w', encoding='utf-8', newline='') as output_file:
        csv_writer = csv.writer(output_file)
        # csv_writer.writerow(['Category', 'Count'])
        for key, value in values.items():
            csv_writer.writerow([key, value])

def save_urls_to_file(output_filename, count):
    csv_filename = output_filename.replace('.txt', '.csv')  # Change file extension to CSV
    with open(csv_filename, 'w', encoding='utf-8', newline='') as output_file:
        csv_writer = csv.writer(output_file)
        # csv_writer.writerow(['Total Number of Unique URLs'])
        csv_writer.writerow([count])

def main():
    parser = argparse.ArgumentParser(description='Find and parse reports.')
    parser.add_argument('-d', '--directory', default='./', help='Directory to scan (default: current directory)')
    parser.add_argument('-p', '--partial-string', default=datetime.today().strftime('%Y%m%d'), help='Partial string to search for (default: today\'s date)')
    args = parser.parse_args()

    find_and_parse_reports(args.directory, args.partial_string)

if __name__ == "__main__":
    main()
