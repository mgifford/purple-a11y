#!/bin/bash

# Function to display usage
usage() {
    echo "Usage: $0 -c <csv_file>"
    echo "  -c: CSV file containing URLs to scan."
    exit 1
}

# Parse command-line options
while getopts ":c:" opt; do
    case ${opt} in
        c )
            csv_file=$OPTARG
            ;;
        \? )
            usage
            ;;
    esac
done

# Check if CSV file is provided
if [ -z "${csv_file}" ]; then
    echo "Error: CSV file not specified."
    usage
    exit 1
fi

# Function to process CSV file
process_csv() {
    # Skip header line if your CSV has headers
    tail -n +2 "${csv_file}" | while IFS=, read -r url
    do
        echo "Processing URL: ${url}"
        # Properly quote the URL and execute the node cli.js command
        node cli.js -c 2 -k MikeGifford:mike.gifford@civicactions.com -p 250 -u "${url}"
    done
}

# Execute function
process_csv
