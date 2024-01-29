# README for Aggregate Scores Script

## Overview
The Aggregate Scores Script is a Python tool designed to compile and summarize data from multiple CSV files related to accessibility scan results over time. This tool is particularly useful for aggregating data from periodic scans of different websites, where each scan results in a set of CSV files. It generates summary files for each domain, showing changes in scores and grades over time.

## Installation Instructions

### Prerequisites
- Python (version 3.x)
- Basic knowledge of command-line operations

### Steps
1. **Install Python**: Ensure Python 3 is installed on your system. You can download it from [the official Python website](https://www.python.org/downloads/).

2. **Download the Script**: Download `aggregate_scores.py` to a known directory on your system.

3. **Prepare Data**: Ensure your CSV files are in the correct format and placed in a directory (e.g., `./summary`).

## Execution Options

### Basic Usage
To run the script, open a command-line interface and navigate to the directory containing `aggregate_scores.py`.

Execute the script with:
```bash
python aggregate_scores.py
```

### Specifying a Directory
By default, the script looks for CSV files in the `./summary` directory. To specify a different directory, use the `-d` or `--directory` option:

```bash
python aggregate_scores.py -d path_to_your_directory
```

Replace `path_to_your_directory` with the path to the directory containing your CSV files.

## Expected Output
- The script reads files ending with `_result.csv` in the specified directory.
- It extracts domain information from the filenames and aggregates data from multiple dates.
- For each domain, it creates a summary CSV file named `{domain}_totals_result.csv`.
- These summary files contain columns for dates and rows for each data point (e.g., `number_urls`, `score`, `grade`), showing their progression over time.

### Example Output
If you have CSV files for `www_cms_gov` and `www_medicare_gov` for different dates, the script will create two files:

1. `www_cms_gov_totals_result.csv`
2. `www_medicare_gov_totals_result.csv`

Each file will have a format similar to:

```
,domain,,cms.gov
date,20240119,20240125
number_urls,99,4
score,0.3525,0.0
grade,B+,A+
```

## Notes
- Ensure the filenames of your CSV files follow the format `domain_date_other.csv`.
- The script assumes that each `_result.csv` file has the same structure and contains `domain`, `date`, `number_urls`, `score`, and `grade` fields.
- For best results, maintain consistent naming conventions and data formats across all CSV files.

## Troubleshooting
If you encounter any issues:
- Check the Python version (it should be Python 3).
- Ensure the CSV files are correctly named and formatted.
- Verify that the specified directory path is correct and accessible.

## Conclusion
This script provides a streamlined way to monitor and visualize changes in accessibility scores over time, making it easier to track improvements and identify areas needing attention.
