### Description of the Python Script

The Python script `sitemap-randomizer.py` is designed to randomize and filter URLs from a specified sitemap URL. It performs the following key operations:

1. **Fetch Sitemap URLs**: Retrieves URLs from the provided sitemap XML URL. It also recursively fetches URLs from any nested sitemaps.

2. **Filter and Randomize URLs**: Filters out URLs based on specified exclude/include strings and randomizes the list.

3. **Output Formatting**: Saves the selected URLs in either XML or CSV format, based on the user's choice.

4. **Command Line Arguments**: Allows users to specify the sitemap URL, the number of URLs to retrieve, strings to exclude/include in URLs, and the output format.

### Markdown Readme for Installation, Execution, and Expected Output

```markdown
# Sitemap Randomizer

Randomize and filter URLs from a specified sitemap.

## Installation

Requires Python and the following packages: `requests`, `lxml`.

1. Install Python.
2. Install dependencies:
   ```bash
   pip install requests lxml
   ```

## Execution

Run the script with the following arguments:

- `-u`: URL of the sitemap (required).
- `-n`: Number of URLs to retrieve (default: 2000).
- `-e`: Strings to exclude from URLs.
- `-i`: Strings to force inclusion from URLs.
- `-f`: Output format (choices: `xml`, `csv`; default: `xml`).

Example:
```bash
python sitemap-randomizer.py -u https://example.com/sitemap.xml -n 2000 -f xml
```

## Expected Output

- The script fetches URLs from the specified sitemap.
- Randomizes and filters these URLs based on the provided criteria.
- Saves the result in either XML or CSV format in a directory named `sitemap` or `csv`.

