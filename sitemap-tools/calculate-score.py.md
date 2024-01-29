### README for Report Parsing Script

#### Description
This Python script is designed to parse a series of report files located within a specific directory structure. It processes CSV files to gather and summarize data, focusing on unique URLs and other data points. The script is useful for analyzing and summarizing large sets of structured data files, particularly those generated from automated tools or batch processes.

#### Requirements
- Python 3.x
- Access to a directory containing report files in CSV format.

#### Features
- Parses report CSV files from a specified directory.
- Summarizes data from these reports, focusing on unique URLs and other key data points.
- Outputs summarized data to CSV files for easy analysis.
- Allows filtering of reports based on a partial string match, useful for processing reports from specific dates or categories.

#### Installation
No additional installation is required beyond having Python 3.x on your system. Ensure that the script file (`find-score.py`) is placed in a location accessible from the command line.

#### Execution Instructions
1. **Prepare Your Data**: Ensure that your report files are organized within a directory structure. The script expects a directory named `reports` within each subdirectory of the specified parent directory.

2. **Run the Script**: Open a command line interface and navigate to the directory containing the script.

3. **Execute Command**: Use the following command format to run the script:
   ```
   python find-score.py -d [directory] -p [partial_string] -o [output_directory]
   ```
   - Replace `[directory]` with the path to the directory containing your report files.
   - The `[partial_string]` argument is optional and filters directories based on the string. It defaults to the current date (format `YYYYMMDD`).
   - Replace `[output_directory]` with the path where you want the output CSV files to be saved.

#### Example Command
```
python find-score.py -d ./reports -p 2024012 -o ./summary
```

#### Expected Output
- The script will process each report in the specified directory, matching the partial string if provided.
- For each processed report, the script will output several CSV files into the specified output directory. Each CSV file contains summarized data for a specific aspect of the report.
- The console will display status messages, including any errors or issues encountered during processing.

#### Troubleshooting
- Ensure that the provided directory path is correct and accessible.
- Check that the report files are in the expected CSV format and located within the `reports` subdirectory.
- If you encounter file not found errors, verify the presence and naming of the report files.

#### Support
For support or further assistance, contact the script maintainer or refer to the documentation of the tools generating the report files.
