# Removes duplicates & creates unique URLs

This Python script performs the following tasks:

- It takes a CSV file as input, which is expected to contain a list of URLs.
- It normalizes the URLs, ensuring they all have the "https://" scheme and removing the "www." prefix if present.
- It checks each URL to see if it should be included based on a list of excluded file extensions.
- It sends HTTP requests to each included URL to check if they are valid and working. It handles redirects and identifies if a URL has been redirected.
- It collects the final valid URLs and saves them to an output CSV file.

$ python remove-duplicates-verify-urls.py -c raw-list-urls.csv



