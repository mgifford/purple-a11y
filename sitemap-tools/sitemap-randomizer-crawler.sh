#!/bin/bash

#
# You will need domain.csv with a list of sitemap.xml files
# Also sitemap-randomizer6.py to consolidate the sitemap.xml files
#

# Directory to save the results
sitemap_directory="sitemap"

# Create the output directory if it doesn't exist
mkdir -p "$sitemap_directory"

# Loop through each line in the domain.csv file
while IFS=, read -r domain_url include_command; do
    # Trim leading and trailing whitespaces
    domain_url=$(echo "$domain_url" | awk '{$1=$1};1')
    include_command=$(echo "$include_command" | awk '{$1=$1};1')

    # Skip blank lines or lines starting with #
    if [[ -z "$domain_url" || "$domain_url" == \#* ]]; then
        continue
    fi

    # Run the Python script with include command (-f cvs)
    python sitemap-randomizer.py -u "$domain_url" -n 2000 -f xml -i "$include_command" 

done < domains.csv
