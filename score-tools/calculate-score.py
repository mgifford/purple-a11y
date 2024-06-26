import csv
import os
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from operator import itemgetter
import argparse

def calculate_score(data, number_urls):
    score = Decimal((data.get('critical', 0) * 3 +
                     data.get('serious', 0) * 2 +
                     data.get('moderate', 0) * 1.5 +
                     data.get('minor', 0)) / (number_urls * 5))
    rounded_score = score.quantize(Decimal('0.0000'), rounding=ROUND_HALF_UP)
    return float(rounded_score) if number_urls != 0 else 0

def calculate_grade(score):
    message = "Automated testing feedback: "
    
    # Scoring for grade
    # Score  = (critical*3 + serious*2 + moderate*1.5 + minor) / urls*5
    grade = None
    
    # Calculate the grade based on the score
    if score == 0:
        grade = "A+"
        message += "No axe errors, great! Have you tested with a screen reader?"
    elif score <= 0.1:
        grade = "A"
        message += "Very few axe errors left! Don't forget manual testing."
    elif score <= 0.3:
        grade = "A-"
        message += "So close to getting the automated errors! Remember keyboard-only testing."
    elif score <= 0.5:
        grade = "B+"
        message += "More work to eliminate automated testing errors. Have you tested zooming in 200% with your browser?"
    elif score <= 0.7:
        grade = "B"
        message += "More work to eliminate automated testing errors. Are the text alternatives meaningful?"
    elif score <= 0.9:
        grade = "B-"
        message += "More work to eliminate automated testing errors. Don't forget manual testing."
    elif score <= 2:
        grade = "C+"
        message += "More work to eliminate automated testing errors. Have you tested in grayscale to see if color isn't conveying meaning?"
    elif score <= 4:
        grade = "C"
        message += "More work to eliminate automated testing errors. Have you checked if gradients or background images are making it difficult to read text?"
    elif score <= 6:
        grade = "C-"
        message += "More work to eliminate automated testing errors. Don't forget manual testing."
    elif score <= 11:
        grade = "D+"
        message += "A lot more work to eliminate automated testing errors. Most WCAG success criteria can be fully automated."
    elif score <= 14:
        grade = "D"
        message += "A lot more work to eliminate automated testing errors. Don't forget manual testing."
    elif score <= 17:
        grade = "D-"
        message += "A lot more work to eliminate automated testing errors. Can users navigate your site without using a mouse?"
    elif score <= 20:
        grade = "F+"
        message += "A lot more work to eliminate automated testing errors. Are there keyboard traps that stop users from navigating the site?"
    else:
        grade = "F"
        message += "A lot more work to eliminate automated testing errors. Considerable room for improvement."
    
    return grade, message

def process_and_append(axe_impact_file, number_urls_file, wcag_conformance_file, url_file, xpath_file, output_file, data, directory):
    axe_impact_path = os.path.join(directory, axe_impact_file)
    number_urls_path = os.path.join(directory, number_urls_file)
    wcag_conformance_path = os.path.join(directory, wcag_conformance_file)
    url_path = os.path.join(directory, url_file)
    xpath_path = os.path.join(directory, xpath_file)
    output_path = os.path.join(directory, output_file)

    try:
        # Extract domain and date from the axe impact file name
        base_name = os.path.splitext(os.path.basename(axe_impact_file))[0]
        parts = base_name.split('_')
        if len(parts) >= 3:
            domain = '_'.join(parts[1:-2])  # Extract everything before the last two elements
            domain = domain.replace('_', '.')  # Replace underscores with dots
            date = parts[-2]

            # Read data from axe impact file
            with open(axe_impact_file, 'r', encoding='utf-8') as axe_file:
                axe_reader = csv.reader(axe_file)
                next(axe_reader)  # Skip header
                axe_data = {row[0]: int(row[1]) for row in axe_reader}

            # Read data from wcagConformance file
            process_wcag_conformance(wcag_conformance_file, data)

            # Read data from number urls file
            with open(number_urls_file, 'r', encoding='utf-8') as nu_file:
                number_urls = int(nu_file.readline().strip())

           # Read data from URL file
            if os.path.exists(url_file):
                process_url(url_file, data)

            # Read data from XPath file
            if os.path.exists(xpath_file):
                process_xpath(xpath_file, data)

            # Update running total
            for key in axe_data:
                data[key] = data.get(key, 0) + axe_data[key]

            # Perform calculations
            score_value = calculate_score(data, number_urls)

            grade_value = calculate_grade(score_value)

            # Append the results to the output file
            with open(output_file, 'a', encoding='utf-8', newline='') as output:
                writer = csv.writer(output)
                writer.writerow(['domain', domain])
                writer.writerow(['date', date])
                # writer.writerow(['critical', data.get('critical', 0)])
                # writer.writerow(['serious', data.get('serious', 0)])
                # writer.writerow(['moderate', data.get('moderate', 0)])
                # writer.writerow(['minor', data.get('minor', 0)])
                writer.writerow(['number_urls', number_urls])
                writer.writerow(['score', score_value])
                writer.writerow(['grade', grade_value[0]])

                # Write the content to a CSV file
                with open('output_wcag_conformance.csv', 'w', encoding='utf-8', newline='') as wcag_output:
                    wcag_writer = csv.writer(wcag_output)
                    for key, value in data.items():
                        wcag_writer.writerow([key, value])

            # Print cumulative counts
            print(f"Domain: {domain}")
            print(f"{extract_date_from_filename(axe_impact_file)}")
            print(f"Number of URLs: {number_urls}")
            print(f"")
            print(f"score = (({data.get('critical', 0)} * 2) +  ({data.get('serious', 0)} * 1.5) + "
                  f"({data.get('moderate', 0)} * 1.25) +  ({data.get('minor', 0)} * 1)) /({number_urls} * 5) ")
            print(f"Score: {score_value}")
            print(f"Grade: {grade_value[0]}")

            # Print the content to the terminal
            print("\nSummary data\n")
            for key, value in data.items():
                if key == 'urls':
                    continue
                elif key == 'xpaths':
                    continue
                print(f"{key}: {value}")

            # Print URL content to the terminal
            if 'urls' in data:
                print("\nMost bugs in the URL:")
                for url in data['urls']:
                    print(f"{url[0]}: {url[1]}")

            # Print XPath content to the terminal
            if 'xpaths' in data:
                print("\nMost bugs in the XPaths:")
                for xpath in data['xpaths']:
                    print(f"{xpath[0]}: {xpath[1]}")

            print(f"\n{'=' * 40}\n\n")

        else:
            print(f"Error: Unexpected file naming pattern for {axe_impact_file}")
            # print("")

    except Exception as e:
        print(f"Error processing files {axe_impact_file}, {number_urls_file}, and {wcag_conformance_file}: {e}")


def extract_date_from_filename(axe_impact_file):
    try:
        # Extracting the 8-digit date from the filename
        date_string = axe_impact_file.split('_')[3]

        # Converting the date string to a datetime object
        date_object = datetime.strptime(date_string, "%Y%m%d")

        # Formatting the datetime object as a human-readable date
        formatted_date = date_object.strftime("%B %d, %Y")

        return formatted_date
    except Exception as e:
        print(f"Error extracting date from filename {axe_impact_file}: {e}")
        return None



def process_wcag_conformance(wcag_conformance_file, data):
    try:
        # Read data from wcagConformance file
        with open(wcag_conformance_file, 'r', encoding='utf-8') as wcag_file:
            wcag_reader = csv.reader(wcag_file)

            for row in wcag_reader:
                if row:  # Check if the row is not empty
                    if len(row) == 2:
                        key, value = row[0], row[1]
                        # Try converting the value to an integer
                        try:
                            data[key] = data.get(key, 0) + int(value)
                        except ValueError:
                            # If conversion fails, print an error and continue
                            print(f"Invalid value format in {wcag_conformance_file}: {row}")
                    else:
                        print(f"Invalid row format in {wcag_conformance_file}: {row}")
    except Exception as e:
        print(f"Error processing wcag conformance file {wcag_conformance_file}: {e}")

def process_url(url_file, data):
    try:
        with open(url_file, 'r', encoding='utf-8') as url_file:
            url_reader = csv.reader(url_file)
            data['urls'] = []

            for row in url_reader:
                if row:  # Check if the row is not empty
                    if len(row) == 2:
                        key, value = row[0], int(row[1])
                        data['urls'].append((key, value))
                    else:
                        print(f"Invalid row format in {url_file}: {row}")

            # Sort URLs by the second column (value) in descending order
            data['urls'] = sorted(data['urls'], key=itemgetter(1), reverse=True)

            # Keep only the top ten URLs
            data['urls'] = data['urls'][:10]

    except Exception as e:
        print(f"Error processing URL file {url_file}: {e}")

def process_xpath(xpath_file, data):
    try:
        with open(xpath_file, 'r', encoding='utf-8') as xpath_file:
            xpath_reader = csv.reader(xpath_file)
            data['xpaths'] = []

            for row in xpath_reader:
                if row:  # Check if the row is not empty
                    if len(row) == 2:
                        key, value = row[0], int(row[1])
                        data['xpaths'].append((key, value))
                    else:
                        print(f"Invalid row format in {xpath_file}: {row}")

            # Sort XPaths by the second column (value) in descending order
            data['xpaths'] = sorted(data['xpaths'], key=itemgetter(1), reverse=True)

            # Keep only the top ten XPaths
            data['xpaths'] = data['xpaths'][:10]

    except Exception as e:
        print(f"Error processing XPath file {xpath_file}: {e}")



def main():
    parser = argparse.ArgumentParser(description='Find and parse reports.')
    parser.add_argument('-d', '--directory', default='./', help='Directory to scan (default: current directory)')
    args = parser.parse_args()

    cumulative_data = {}

    print(f"Purple A11y Accessibility Summaries")
    print(f"((Critical * 3 + Serious * 2 + Moderate * 1.5 + Minor * 1) / URLs * 5 * 100) / 100")
    today_date = datetime.now().date()
    print(f"Script run: {today_date}")
    print(f"Directory: {args.directory}")
    print(f"")

    for filename in os.listdir(args.directory):
        if filename.endswith("_axeImpact.csv"):
            axe_impact_file = os.path.join(args.directory, filename)
            number_urls_file = os.path.join(args.directory, filename.replace('_axeImpact.csv', '_number_urls.csv'))
            wcag_conformance_file = os.path.join(args.directory, filename.replace('_axeImpact.csv', '_wcagConformance.csv'))
            url_file = os.path.join(args.directory, filename.replace('_axeImpact.csv', '_url.csv'))
            xpath_file = os.path.join(args.directory, filename.replace('_axeImpact.csv', '_xpath.csv'))
            output_file = os.path.join(args.directory, filename.replace('_axeImpact.csv', '_result.csv'))

            data = {}

            process_and_append(axe_impact_file, number_urls_file, wcag_conformance_file, url_file, xpath_file, output_file, data, args.directory)

            # Include processing for wcagConformance file
            if os.path.exists(wcag_conformance_file):
                process_wcag_conformance(wcag_conformance_file, data)

            # Include processing for URL file
            if os.path.exists(url_file):
                process_url(url_file, data)

            # Include processing for XPath file
            if os.path.exists(xpath_file):
                process_xpath(xpath_file, data)


if __name__ == "__main__":
    main()
