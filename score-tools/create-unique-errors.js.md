## HTML Processor Script

This script processes a CSV file containing HTML data, sanitizes the HTML content, generates an MD5 hash for each HTML fragment, and writes the processed data back to a CSV file.

### Installation

1. Ensure you have Node.js installed on your system. You can download it from [here](https://nodejs.org/).
2. Clone or download the repository containing the script.
3. Navigate to the directory containing the script in your terminal.

### Dependencies

This script utilizes several Node.js packages:

- `fs`: File system module for reading and writing files.
- `csv-parser`: Library for parsing CSV files.
- `csv-writer`: Library for writing CSV files.
- `crypto`: Node.js module for cryptographic functionality.
- `JSDOM`: A JavaScript implementation of the DOM and HTML standards.
- `yargs`: Library for parsing command-line arguments.

Before running the script, make sure to install these dependencies by running the following command in your terminal:

```bash
npm install fs csv-parser csv-writer crypto jsdom yargs
```

### Usage

To run the script, execute the following command in your terminal:

```bash
node <script_name>.js -f <input_file_path> -o <output_file_path>
```

Replace `<script_name>.js` with the name of the script file, `<input_file_path>` with the path to the input CSV file, and `<output_file_path>` with the desired path for the output CSV file.

#### Command-line arguments:

- `-f, --file`: Path to the input CSV file (required).
- `-o, --output`: Optional. Path to the output CSV file. If not provided, the output file will be named based on the input file with '-processed.csv' appended.

### Functions

#### `generateMD5Hash(data)`

- Generates an MD5 hash for the given data.
- **Parameters:**
  - `data`: The data for which the MD5 hash is to be generated.
- **Returns:** 
  - The MD5 hash of the input data.

#### `sanitizeHtml(html)`

- Sanitizes the HTML content by removing unwanted attributes and text nodes.
- **Parameters:**
  - `html`: The HTML content to be sanitized.
- **Returns:** 
  - The sanitized HTML content.

#### `processCSV(inputFile, outputFile)`

- Processes the input CSV file, sanitizes the HTML content, generates MD5 hashes, and writes the processed data back to a CSV file.
- **Parameters:**
  - `inputFile`: Path to the input CSV file.
  - `outputFile`: Path to the output CSV file.

### Output

After running the script, the processed CSV file will be generated at the specified output path. Each row in the output file will contain additional columns:

- `uniqueIdentifier`: MD5 hash generated from the combination of URL and XPath columns.
- `strippedHtml`: Sanitized HTML content.
- `htmlFingerprint`: MD5 hash generated from the sanitized HTML content.

### Example

```bash
node html_processor.js -f input.csv -o output.csv
```

This command will process the `input.csv` file, sanitize the HTML content, generate MD5 hashes, and write the processed data to `output.csv`.
