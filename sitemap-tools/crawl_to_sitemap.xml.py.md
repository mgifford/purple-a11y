### Description of the Python Script

This Python script is a web crawler designed to generate a sitemap of a given website. It systematically crawls the website, starting from a specified URL, and creates an XML sitemap that lists all the unique URLs found on the site. The script adheres to the rules specified in the website's `robots.txt` file, ensuring it respects the site's crawling policies. 

Key functionalities of the script include:

1. **URL Crawling**: The script starts at a user-defined URL and explores the site by following hyperlinks (`<a>` tags).
2. **Robots.txt Compliance**: It checks the site's `robots.txt` file to ensure that it's allowed to crawl each URL.
3. **Content Filtering**: It filters out non-HTML content and specific URL fragments.
4. **Sitemap Generation**: Unique URLs are collected and an XML sitemap is generated, excluding URLs ending with `.pdf` or `.xml`.
5. **Command-Line Interface**: The script accepts parameters for the starting URL and output file path via command line.

### Installation & Execution Instructions

1. **Install Python**: Ensure you have Python installed on your system. This script requires Python 3.

2. **Install Dependencies**:
   - Open a terminal and install the required Python libraries by running:
     ```
     pip install requests beautifulsoup4
     ```

3. **Run the Script**:
   - Navigate to the script's directory in the terminal.
   - Use the script with command-line arguments. For example:
     ```
     python script_name.py -s http://example.com -o sitemap.xml
     ```
   - Replace `http://example.com` with the URL of the site you want to crawl and `sitemap.xml` with your desired output file name.
