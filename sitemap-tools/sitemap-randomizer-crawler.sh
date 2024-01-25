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
while IFS=, read -r domain_url include_command required_csv; do
    # Skip blank lines or lines starting with #
    if [[ -z "$domain_url" || "$domain_url" == \#* ]]; then
        continue
    fi

    # Trim leading and trailing whitespaces and carriage returns
    domain_url=$(echo "$domain_url" | tr -d '\r' | awk '{$1=$1};1')
    include_command=$(echo "$include_command" | awk '{$1=$1};1')
    required_csv=$(echo "$required_csv" | awk '{$1=$1};1')

    # Extract the domain name from the URL
    domain_name=$(echo "$domain_url" | awk -F/ '{print $3}') # Extract domain from URL

    # Sanitize the filename to remove any special characters
    formatted_include_command=$(echo "$include_command" | tr '/' '-' | tr -d '[:space:]')
    formatted_include_command=$(echo "$formatted_include_command" | sed 's/[^a-zA-Z0-9_-]//g')

    # Check for valid URL scheme
    if [[ ! "$domain_url" =~ ^https?:// ]]; then
        echo "Invalid URL (missing http/https scheme): $domain_url"
        continue
    fi

    # Format the filename
    today_date=$(date +%d%b%Y)
    domain_name=$(echo "$domain_url" | awk -F[/:] '{print $4}') # Extract domain name
    filename="${domain_name}-${today_date}"

    if [ -n "$formatted_include_command" ]; then
        filename+="-${formatted_include_command}"
    fi
    if [ -n "$required_csv" ]; then
        required_csv_basename=$(basename "$required_csv" .csv)
        filename+="-required-${required_csv_basename}"
    fi
    filename+=".xml"

    # Run the Python script with include command (-f csv)
    python sitemap-randomizer.py -u "$domain_url" -n 2000 -f xml -i "$include_command" -o "$sitemap_directory/$filename"

    # Execute required files
    if [ -n "$required_csv" ]; then
        required_filename="required-${filename}"
        python sitemap-randomizer-add-csv.py -x "$sitemap_directory/$filename" -c "$required_csv" -o "$sitemap_directory/$required_filename"
        echo "Additional processing with $required_csv completed for $required_filename"
    fi

    # Show roughly how many URLs are in the scan
    wc 1 "$sitemap_directory/$required_filename"

done < "$csv_file"
