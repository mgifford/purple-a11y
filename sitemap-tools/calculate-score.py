# 
# Calculate Score
# It is great to have a summary of the purple-hats findings, but it is more important to have a numerical score to build on.
# 

import csv
import os

def calculate_score(data, number_urls):
    # Calculate the score based on your formula
    score = (data.get('critical', 0) * 2 +
             data.get('serious', 0) * 1.5 +
             data.get('moderate', 0) * 1.25 +
             data.get('minor', 0)) / (number_urls * 5) if number_urls != 0 else 0
    return score

def process_and_append(axe_impact_file, number_urls_file, output_file, data):
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

            # Read data from number urls file
            with open(number_urls_file, 'r', encoding='utf-8') as nu_file:
                number_urls = int(nu_file.readline().strip())

            # Perform calculations
            score_value = calculate_score(axe_data, number_urls)

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
        else:
            print(f"Error: Unexpected file naming pattern for {axe_impact_file}")
    except Exception as e:
        print(f"Error processing files {axe_impact_file} and {number_urls_file}: {e}")



def main():
    input_directory = "./"  # Replace with the path to your directory

    for filename in os.listdir(input_directory):
        if filename.endswith("_axeImpact.csv"):
            axe_impact_file = os.path.join(input_directory, filename)
            number_urls_file = os.path.join(input_directory, filename.replace('_axeImpact.csv', '_number_urls.csv'))
            output_file = os.path.join(input_directory, filename.replace('_axeImpact.csv', '_result.csv'))

            # Initialize an empty dictionary for data (assuming it's initially empty)
            data = {}

            process_and_append(axe_impact_file, number_urls_file, output_file, data)
            # process_and_append(axe_impact_file, number_urls_file, output_file)

if __name__ == "__main__":
    main()
