import csv
import os
import glob
import argparse
from collections import defaultdict

def extract_domain(filename):
    # Assumes the filename format is 'domain_date_other.csv'
    parts = os.path.basename(filename).split('_')
    if len(parts) > 1:
        return '_'.join(parts[:-2])  # Extract everything before the last two parts
    return 'unknown'

def read_result_file(filename):
    data = {}
    with open(filename, 'r', encoding='utf-8') as file:
        reader = csv.reader(file)
        for row in reader:
            if row:  # Skip empty rows
                key, value = row[0], row[1]
                data[key] = value
    return data

def write_summary_file(output_filename, all_data):
    headers = sorted(all_data.keys())
    dates = sorted(all_data[headers[0]].keys())

    with open(output_filename, 'w', newline='', encoding='utf-8') as file:
        writer = csv.writer(file)
        writer.writerow([''] + ['domain'] + [''] * (len(dates) - 1))
        writer.writerow([''] + dates)

        for header in headers:
            row = [header]
            for date in dates:
                row.append(all_data[header].get(date, ''))
            writer.writerow(row)

def aggregate_results(directory):
    domain_data = defaultdict(lambda: defaultdict(dict))

    for filename in glob.glob(os.path.join(directory, '*_result.csv')):
        domain = extract_domain(filename)
        data = read_result_file(filename)
        date = data.get('date', 'unknown')

        for key in data:
            if key != 'domain' and key != 'date':  # Skip 'domain' and 'date' keys
                domain_data[domain][key][date] = data[key]

    return domain_data

def main():
    parser = argparse.ArgumentParser(description='Aggregate scores from CSV files.')
    parser.add_argument('-d', '--directory', default='./summary', help='Directory containing the CSV files')
    args = parser.parse_args()

    directory = args.directory
    domains_data = aggregate_results(directory)

    for domain, data in domains_data.items():
        output_filename = f'{domain}_totals_result.csv'
        write_summary_file(output_filename, data)
        print(f"Summary file created for {domain}: {output_filename}")

if __name__ == "__main__":
    main()
