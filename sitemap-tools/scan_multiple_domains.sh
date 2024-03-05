#!/bin/bash

# Initialize a variable to hold the CSV file name
CSV_FILE=""

# Use getopts to parse the command-line options. Here, we look for the -f option followed by an argument (the file name)
while getopts ":f:" opt; do
  case ${opt} in
    f )
      CSV_FILE=$OPTARG
      ;;
    \? )
      echo "Invalid option: $OPTARG" 1>&2
      ;;
    : )
      echo "Invalid option: $OPTARG requires an argument" 1>&2
      ;;
  esac
done
shift $((OPTIND -1))

# Check if the CSV file name was provided. If not, print an error message and exit
if [ -z "$CSV_FILE" ]; then
    echo "Usage: $0 -f <csv_file_name>"
    exit 1
fi

# Read each line in the CSV file
while IFS= read -r line
do
    # Assuming each line in your CSV is a URL
    URL=$line
    # Run your command with the URL
    node cli.js -u "$URL" -c 2 -p 2000 -k "mike gifford:mike.gifford@civicactions.com"
done < "$CSV_FILE"
