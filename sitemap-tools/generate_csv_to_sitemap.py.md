### Description of the Python Script

The Python script is designed to verify URLs from a CSV file, handle redirects, and generate an XML sitemap from the verified URLs. The script performs several key functions:

1. **URL Verification**: Checks each URL for availability (HTTP status code 200) and follows redirects to find the final URL.

2. **Preprocess URLs**: Tries different URL prefixes (like `https://`, `http://www.`, etc.) to find a valid URL.

3. **Reading URLs from CSV**: Reads a list of URLs from a specified CSV file.

4. **Generate XML Sitemap**: Creates an XML sitemap for valid URLs, excluding URLs containing `.pdf` or `.xml`.

5. **Duplicate Check**: Checks for and reports duplicate URLs in the generated sitemap.

6. **Error Handling and Logging**: Logs messages for redirects, errors, skipped URLs, and duplicate URLs. It also maintains a count of checked URLs and a list of failed URLs.

### Installation Instructions

1. **Install Python**: Ensure Python 3.x is installed on your system.

2. **Install Required Libraries**: This script requires the `requests` library. Install it using:
   ```bash
   pip install requests
   ```

### Execution Instructions

1. **Prepare a CSV File**: Ensure you have a CSV file with URLs to check. Each URL should be on a new line.

2. **Run the Script**:
   - Navigate to the script's directory in your command line.
   - Execute the script with the required arguments:
     ```bash
     python script_name.py -c path_to_your_csv.csv -o output_sitemap.xml
     ```
   - Replace `script_name.py` with the name of your script file, `path_to_your_csv.csv` with the path to your CSV file, and `output_sitemap.xml` with your desired output file name.

### Expected Output

The script will:

- Log the process of checking and following redirects for each URL.
- Report any failed URLs and reasons for failure.
- Generate an XML sitemap of valid URLs, excluding any URLs that end in `.pdf` or `.xml`.
- Report any duplicate URLs found in the sitemap.
- Save the sitemap to the specified output file.

---

### Conversion to Node.js

To convert this script to Node.js, we'll use equivalent libraries available in the Node.js ecosystem and replicate the script's functionality. We will use:

- `axios` for HTTP requests (similar to `requests` in Python).
- `csv-parser` for reading CSV files.
- `xml2js` for generating XML content.
- Node.js's built-in modules for filesystem operations and URL parsing.

