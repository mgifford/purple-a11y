### Description of the Python Script

The Python script `sitemap-discovery.py` is designed to discover and validate sitemaps for a list of domain names. It performs several key operations:

1. **Reads Domain Names**: The script reads a list of domain names from a CSV file named `"domain_source.csv"`.

2. **Checks for Sitemap**: For each domain, it checks if the domain's root (`/`) and the `/sitemap.xml` path are accessible. 

3. **Validates Sitemap**: The script validates the sitemap against the XML schema defined at `http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd`.

4. **Generates Output Files**: 
   - It saves successfully discovered sitemaps to `"sitemap_extracts.csv"`.
   - It records domains where sitemaps were not found or were invalid in `"sitemap_failures.csv"`.

5. **Error Handling**: The script handles request exceptions and logs them, adding the respective domains to the failure list.

### Markdown Readme for Installation, Execution, and Expected Output

```markdown
# Sitemap Discovery

This Python script discovers and validates sitemaps for a list of domain names.

## Installation

1. Make sure Python is installed on your system.
2. Install required Python packages:
   ```
   pip install requests beautifulsoup4 lxml
   ```

## Execution

1. Place a CSV file named `domain_source.csv` in the same directory as the script. This file should contain a list of domain names, one per line.
2. Run the script:
   ```
   python sitemap-discovery.py
   ```

## Expected Output

- The script will check each domain for the availability of a sitemap.
- It validates found sitemaps against a standard XML schema.
- Successfully discovered sitemaps are saved to `sitemap_extracts.csv`.
- Domains without valid sitemaps are saved to `sitemap_failures.csv`.
- The script prints the domains with and without sitemaps to the console.
