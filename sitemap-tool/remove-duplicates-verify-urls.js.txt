This Node.js script performs the following tasks:

1. Reads a CSV file containing URLs, where each URL is on a separate line.
2. Normalizes each URL by adding the "https://" scheme and removing the "www." prefix if present.
3. Checks if each URL should be included based on a predefined list of excluded file extensions.
4. Sends HTTP requests to each included URL to check their validity and whether they are redirected.
5. Collects the final valid URLs and saves them to an output CSV file.
6. Prints a list of invalid URLs that don't conform to the inclusion criteria.
7. Prints a list of URLs that were redirected, showing both the original and final URLs.

To install the required dependencies on a Mac, you can follow these steps:

1. Open your terminal.

2. Navigate to the directory where you have the Node.js script and where you want to run it.

3. Use the following command to install the necessary dependencies (assuming you are using `csv-parse` for CSV parsing):

```bash
npm install csv-parse
```

This command will download and install the `csv-parse` library along with its dependencies.

To execute the script, follow these steps:

1. Open your terminal.

2. Navigate to the directory where you have the Node.js script.

3. Run the script using the `node` command and provide the required command-line arguments:

```bash
node remove-duplicates-verify-urls.js -c <inputCSVFile> -o <outputCSVFile>
```

Replace `<inputCSVFile>` with the path to your input CSV file containing the URLs, and `<outputCSVFile>` with the desired name for the output CSV file that will contain the final valid URLs.

For example:

```bash
node remove-duplicates-verify-urls.js -c input.csv -o output.csv
```

The script will process the input CSV file, perform URL validation and redirection checks, and save the final valid URLs to the specified output CSV file. It will also print lists of invalid URLs and redirected URLs to the terminal if applicable.
