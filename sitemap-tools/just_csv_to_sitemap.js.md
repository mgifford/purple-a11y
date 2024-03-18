### Script Documentation

This script converts a CSV file containing URLs into a sitemap.xml file format. Optionally, it can randomize the order of URLs in the sitemap.

#### Instructions to Run:

1. Ensure you have Node.js installed on your system.
2. Install the required npm packages by running `npm install csv-parser yargs` in your terminal.
3. Save the script in a file, e.g., `csvToSitemap.js`.
4. Prepare a CSV file containing the URLs.
5. Run the script with appropriate command line arguments.

#### Command Line Options:

- `-c, --csv <file_path>`: Specify the input CSV file path.
- `-o, --output <file_path>`: Specify the output sitemap.xml file path.
- `-r, --randomize`: (Optional) Randomize the order of URLs in the sitemap.

#### Example Usage:

```bash
node csvToSitemap.js -c input.csv -o sitemap.xml -r
```

#### Expected Results:

- The script will read the CSV file specified by `-c` option.
- It will then convert the CSV content into a sitemap.xml format.
- If the `-r` option is provided, the order of URLs in the sitemap will be randomized.
- The sitemap.xml file will be created at the path specified by the `-o` option.
- Upon successful completion, the script will print "Conversion completed!".

#### Note:

- Ensure proper permissions for reading from the CSV file and writing to the output file.
- Errors encountered during the process will be logged to the console.
