#!/bin/bash

# Default directory containing .xml files
sitemap_dir="/Users/mgifford/CA-Sitemap-Scans/sitemap/"
today_date=$(date +"%d%b%Y") # Adjusted date format
filter=""

# Function to display usage
usage() {
    echo "Usage: $0 [ -d | -a | -s <string> ]"
    echo "  -d: Select files with today's date."
    echo "  -a: Select all files."
    echo "  -s <string>: Select files containing a specific string."
    exit 1
}

# Parse command-line options
while getopts ":das:" opt; do
    case ${opt} in
        d ) filter="$today_date";;
        a ) filter="";;
        s ) filter="$OPTARG";;
        \? ) usage;;
    esac
done
echo $filter

# Iterate over each .xml file in the directory based on the filter
for file in "$sitemap_dir"*"$filter"*.xml; do
    echo $file
    # Check if the file is a regular file
    if [ -f "$file" ]; then
        # Run the provided command for each file
        node cli.js -c 1 -k MikeGifford:mike.gifford@civicactions.com -p 2000 -u "file://$file"
    fi
done
