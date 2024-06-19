/*

	1.	File Imports and Paths:
	•	The script imports necessary modules (fs, path, csv-parse/sync, and csv-stringify/sync).
	•	Defines paths for the input and output CSV files.
	2.	parseCSV Function:
	•	Reads the CSV file and parses its contents into an array of records.
	•	Uses various options to handle columns, trimming, and skipping empty lines or lines with errors.
	3.	writeCSV Function:
	•	Converts an array of records into CSV format and writes it to the specified file.
	4.	cleanCSV Function:
	•	Main function that processes the CSV to remove duplicates.
	•	Utilizes a Map to track domains, prioritizing ‘www.’ versions if both ‘www.’ and non-‘www.’ versions exist.
	•	Writes the cleaned records to the output CSV file.
	5.	Execution:
	•	Calls the cleanCSV function to start the cleaning process.

*/

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');

const inputFilePath = path.join(__dirname, 'drupal-sites.csv');
const outputFilePath = path.join(__dirname, 'drupal-sites-sans-duplicates.csv');

// Function to parse CSV
function parseCSV(filePath) {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    return parse(fileContent, {
        columns: true,
        trim: true,
        skip_empty_lines: true,
        relax_column_count: true,
        skip_lines_with_error: true
    });
}

// Function to write CSV
function writeCSV(filePath, data) {
    const output = stringify(data, { header: true });
    fs.writeFileSync(filePath, output);
}

// Main function to clean the CSV
async function cleanCSV() {
    try {
        const records = parseCSV(inputFilePath);
        const domainMap = new Map();

        records.forEach(record => {
            const domain = record[Object.keys(record)[0]];
            const wwwDomain = domain.startsWith('www.') ? domain : `www.${domain}`;
            const nonWwwDomain = domain.startsWith('www.') ? domain.substring(4) : domain;

            if (!domainMap.has(wwwDomain) && !domainMap.has(nonWwwDomain)) {
                domainMap.set(wwwDomain, record);
            } else if (domainMap.has(nonWwwDomain)) {
                domainMap.delete(nonWwwDomain);
                domainMap.set(wwwDomain, record);
            }
        });

        const cleanedRecords = Array.from(domainMap.values());
        writeCSV(outputFilePath, cleanedRecords);

        console.log(`CSV cleaned successfully. Output written to ${outputFilePath}`);
    } catch (error) {
        console.error(`Error cleaning CSV: ${error.message}`);
    }
}

cleanCSV();
