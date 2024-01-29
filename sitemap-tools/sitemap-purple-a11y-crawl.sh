#!/bin/bash

# Default directory containing .xml files
sitemap_dir="/Users/mgifford/CA-Sitemap-Scans/sitemap/"
today_date=$(date +"%d%b%Y") # Adjusted date format
filter=""
clean=0  # Flag for cleaning XML files
temp_file="temp_cli_output.txt"  # Temporary file to store output

# Function to display usage
usage() {
    echo "Usage: $0 [ -d | -a | -s <string> | -c ]"
    echo "  -d: Select files with today's date."
    echo "  -a: Select all files."
    echo "  -s <string>: Select files containing a specific string."
    echo "  -c: Clean XML files before processing."
    exit 1
}

# Parse command-line options
while getopts ":das:c" opt; do
    case ${opt} in
        d ) filter="$today_date";;
        a ) filter="";;
        s ) filter="$OPTARG";;
        c ) clean=1;;
        \? ) usage;;
    esac
done

# Iterate over each .xml file in the directory based on the filter
for file in "$sitemap_dir"*"$filter"*.xml; do
    # Check if the file is a regular file
    if [ -f "$file" ]; then
        # Run these commands for each file
        if [ "$clean" -eq 1 ]; then
            echo "Cleaning $file..."
            python ../update_sitemap.py -x "$file"
        fi
        echo "Processing $file..."
        # Run node script and save output to temp file
        node cli.js -c 1 -k MikeGifford:mike.gifford@civicactions.com -p 2000 -u "file://$file" > "$temp_file"

        cat "$temp_file"
        
        # Extract directory paths from temp file
        while read -r line; do
            if [[ $line == *"Results directory is at"* ]]; then
                # Extract and process directory path
                directory=$(echo $line | awk '{print $6}')
                echo "Found directory: $directory"
                # Process the directory as needed
                # e.g., check for report.csv file
                report_file="$directory/reports/report.csv"
                if [ -f "$report_file" ]; then
                    echo "Found report file: $report_file"
                    # Further processing here
                else
                    echo "Report file not found: $report_file"
                fi
            fi
        done < "$temp_file"
    fi
done

# Clean up temporary file
rm -f "$temp_file"
