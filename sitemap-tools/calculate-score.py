import csv
import os
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP

def calculate_score(data, number_urls):
    # Calculate the score based on your formula
    score = Decimal((data.get('critical', 0) * 3 +
             data.get('serious', 0) * 2 +
             data.get('moderate', 0) * 1.5 +
             data.get('minor', 0)) / (number_urls * 5))

    rounded_score = score.quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)
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

def process_and_append(axe_impact_file, number_urls_file, wcag_conformance_file, output_file, data):
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
                writer.writerow(['critical', data.get('critical', 0)])
                writer.writerow(['serious', data.get('serious', 0)])
                writer.writerow(['moderate', data.get('moderate', 0)])
                writer.writerow(['minor', data.get('minor', 0)])
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
            print(f"Number of URLs: {number_urls}")
            print(f"")
            # print(f"Critical: {data.get('critical', 0)}")
            # print(f"Serious: {data.get('serious', 0)}")
            # print(f"Moderate: {data.get('moderate', 0)}")
            # print(f"Minor: {data.get('minor', 0)}")
            print(f"score = (({data.get('critical', 0)} * 2) +  ({data.get('serious', 0)} * 1.5) + "
                  f"({data.get('moderate', 0)} * 1.25) +  ({data.get('minor', 0)} * 1)) /({number_urls} * 5) ")
            print(f"Score: {score_value}")
            print(f"Grade: {grade_value[0]}")

            # Print the content to the terminal
            print("Content from wcag conformance file:")
            for key, value in data.items():
                print(f"{key}: {value}")

            print(f"")
            print(f"")

        else:
            print(f"Error: Unexpected file naming pattern for {axe_impact_file}")
            # print("")
    except Exception as e:
        print(f"Error processing files {axe_impact_file}, {number_urls_file}, and {wcag_conformance_file}: {e}")


def main():
    input_directory = "./"  # Replace with the path to your directory

    cumulative_data = {}

    print(f"Purple A11y Accessibility Summaries")
    print(f"")
    print(f"((Critical * 3 + Serious * 2 + Moderate * 1.5 + Minor * 1) / URLs * 5 * 100) / 100")

    # Get today's date
    today_date = datetime.now().date()

    # Print the date in a formatted string
    print(f"Script run: {today_date}")
    print(f"Directory: {input_directory}")
    print(f"")

    for filename in os.listdir(input_directory):
        if filename.endswith("_axeImpact.csv"):
            axe_impact_file = os.path.join(input_directory, filename)
            number_urls_file = os.path.join(input_directory, filename.replace('_axeImpact.csv', '_number_urls.csv'))
            wcag_conformance_file = os.path.join(input_directory, filename.replace('_axeImpact.csv', '_wcagConformance.csv'))
            output_file = os.path.join(input_directory, filename.replace('_axeImpact.csv', '_result.csv'))

            # Initialize an empty dictionary for data (assuming it's initially empty)
            data = {}

            process_and_append(axe_impact_file, number_urls_file, wcag_conformance_file, output_file, data)

            # Include processing for wcagConformance file
            if os.path.exists(wcag_conformance_file):
                process_wcag_conformance(wcag_conformance_file, data)


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


if __name__ == "__main__":
    main()
