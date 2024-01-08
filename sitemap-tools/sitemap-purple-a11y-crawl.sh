#!/bin/bash

# Directory containing .xml files
sitemap_dir="./sitemaps/"

# Iterate over each .xml file in the directory
for file in "$sitemap_dir"*.xml; do
    # Check if the file is a regular file
    if [ -f "$file" ]; then
        # Run the provided command for each file - scan for a maximum of 2000 URLs
        node cli.js -c 1 -k UserName:user@github.com -p 2000 -u "file://$file"
    fi
done
