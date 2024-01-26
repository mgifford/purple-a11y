#!/bin/bash

# Default directory containing .xml files
sitemap_dir="/Users/mgifford/CA-Sitemap-Scans/sitemap/"
today_date=$(date +"%d%b%Y") # Adjusted date format
filter=""
clean=0  # Flag for cleaning XML files

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
        node cli.js -c 1 -k MikeGifford:mike.gifford@civicactions.com -p 2000 -u "file://$file"
    fi
done
