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
