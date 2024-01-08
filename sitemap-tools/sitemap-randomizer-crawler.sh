#!/bin/bash

#
# You will need domain.csv with a list of sitemap.xml files
# Also sitemap-randomizer.py to consolidate the sitemap.xml files
#

# Default CSV file
csv_file="domains.csv"

# Directory to save the results
sitemap_directory="sitemap"

# Parse command-line arguments
while getopts ":f:" opt; do
  case ${opt} in
    f ) csv_file=$OPTARG ;;
    \? )
      echo "Usage: $0 [-f CSV_FILE]"
      exit 1
      ;;
  esac
done

# Create the output directory if it doesn't exist
mkdir -p "$sitemap_directory"

# Loop through each line in the CSV file
while IFS=, read -r domain_url include_command; do
    # Trim leading and trailing whitespaces
    domain_url=$(echo "$domain_url" | awk '{$1=$1};1')
    include_command=$(echo "$include_command" | awk '{$1=$1};1')

    # Skip blank lines or lines starting with #
    if [[ -z "$domain_url" || "$domain_url" == \#* ]]; then
        continue
    fi

    # Run the Python script with include command (-f csv)
    python sitemap-randomizer.py -u "$domain_url" -n 2000 -f xml -i "$include_command"

done < "$csv_file"
