# README for Report Parser and Aggregator Script

## Overview
The Report Parser and Aggregator Script is designed to scan a directory for specific reports, parse them, and generate aggregated summaries. It efficiently processes large sets of CSV reports, focusing on data relevant to a given date or identifier, and outputs the summarized data in a structured format.

## Installation Instructions

### Prerequisites
- Python (version 3.x or later)
- CSV report files following a specific naming pattern

### Steps
1. **Install Python**: If not already installed, download and install Python 3 from [the official Python website](https://www.python.org/downloads/).

2. **Script Setup**: Download the script file `report_parser_aggregator.py` to your computer.

3. **Prepare Reports**: Ensure that your CSV report files are in an organized directory structure. The script expects files in subdirectories named with a pattern that includes a date or a specific partial string.

## Execution Options

### Basic Usage
Navigate to the directory containing the script and execute it using Python:

```bash
python report_parser_aggregator.py
```

### Custom Directory and Date
To specify a different directory to scan for reports and a specific partial string (like a date) to filter the reports, use:

```bash
python report_parser_aggregator.py -d /path/to/your/directory -p 20240125
```

Replace `/path/to/your/directory` with the path to your reports and `20240125` with your specific date or partial string.

### Output Directory
To define a custom output directory for the generated summary files, use the `-o` option:

```bash
python report_parser_aggregator.py -o /path/to/output/directory
```

Replace `/path/to/output/directory` with your desired output directory.

## Expected Output
- The script scans the specified directory for subdirectories containing report CSV files.
- It identifies and processes reports based on the given date or partial string.
- For each report, the script generates summarized data for different columns (like `axeImpact`, `context`, `howToFix`) and saves them as separate CSV files.
- A summary of the total number of unique URLs encountered in the reports is also generated.
- The output files are saved in the specified output directory with a naming pattern that includes the domain and timestamp.

## Output Files Example
- `domainname_20240125_axeImpact.csv`
- `domainname_20240125_context.csv`
- `domainname_20240125_number_urls.csv`
- etc.

## Notes
- Ensure that your CSV files and directories are named according to the expected patterns for the script to correctly identify and process them.
- The script's output provides a concise summary of the data across different reports, making it easier to analyze trends or specific aspects over time.

## Conclusion
This script is a powerful tool for aggregating and summarizing data from multiple CSV reports. It is particularly useful for tracking changes or trends in data over time and can be adapted to various reporting needs in data analysis projects.
