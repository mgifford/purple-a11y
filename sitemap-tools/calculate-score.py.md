### Description of the Python Script for README

#### Overview
This Python script is designed to process accessibility testing data, specifically focusing on analyzing and grading web content based on automated accessibility testing results. It calculates a score and assigns a grade based on the severity and frequency of accessibility issues found.

#### Functionality
- **Data Processing**: The script reads multiple CSV files containing information about accessibility issues categorized by severity (critical, serious, moderate, minor), the total number of URLs tested, and specific issues identified by URL and XPath.
- **Score Calculation**: It calculates a score based on a weighted formula considering the severity of issues and the number of URLs.
- **Grade Assignment**: Based on the calculated score, it assigns a grade ranging from A+ (best) to F (worst), along with a feedback message.
- **Reporting**: Outputs a summary report including domain, date, issue counts, score, grade, and details about specific URLs and XPaths with the most issues.

#### Installation
1. Ensure Python (version 3.x or later) is installed on your system.
2. Clone or download the script to your local machine.
3. No external Python libraries are required for this script.

#### Execution
To run the script, navigate to the script's directory in the terminal and execute:

```bash
python <script_name>.py
```

##### Options
- The script automatically processes all relevant CSV files in its directory.
- Customize the input directory by modifying the `input_directory` variable in the `main` function.

#### Result
The script will output:
- A CSV file with the calculated score, grade, and a summary of the accessibility issues found.
- Printed summaries in the console for each processed domain, including details about the most problematic URLs and XPaths.
