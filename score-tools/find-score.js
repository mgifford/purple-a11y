// Import necessary modules
import fs from 'fs';
import csv from 'csv-parser';
import path from 'path';

// Get current date in YYYY-MM-DD format
const datetime = new Date().toISOString().slice(0, 10);

// Function to find and parse reports in a directory
async function findAndParseReports(directory, partialString) {
    const subdirs = await fs.promises.readdir(directory);

    // Loop through each subdirectory - Check if the subdirectory name includes the partial string
    for (const subdir of subdirs) {
        if (subdir.includes(partialString)) {
            const reportDirectory = path.join(directory, subdir, 'reports');
            if (fs.existsSync(reportDirectory)) {
                const domain = await getDomainFromCsv(path.join(reportDirectory, 'report.csv'));
                const timestamp = subdir.split('_')[0];
                const outputFilenameBase = `${domain}_${timestamp}`;

                const summary = await updateSummary(reportDirectory);
                const uniqueUrls = await getUniqueUrls(path.join(reportDirectory, 'report.csv'));

                // Save each column of the summary to a separate file
                for (const column in summary) {
                    const outputFilename = `${outputFilenameBase}_${column}.txt`;
                    await saveSummaryToFile(outputFilename, summary[column]);
                }

                // Save the number of unique URLs to a file
                const outputFilenameUrls = `${outputFilenameBase}_number_urls.txt`;
                await saveUrlsToFile(outputFilenameUrls, uniqueUrls.size);
            }
        }
    }
}

// Function to extract domain from the first row of a CSV file
async function getDomainFromCsv(csvFile) {
    if (fs.existsSync(csvFile)) {
        const firstRow = await getFirstRow(csvFile);
        if (firstRow) {
            const url = firstRow[4];
            return extractDomain(url);
        }
    }
    return 'unknown_domain';
}

// Function to extract domain from a URL
function extractDomain(url) {
    return url.split('/')[2].replace(/\./g, '_');
}

// Function to get unique URLs from a CSV file
async function getUniqueUrls(csvFile) {
    const uniqueUrls = new Set();
    if (fs.existsSync(csvFile)) {
        const rows = await getCsvRows(csvFile);
        for (const row of rows) {
            uniqueUrls.add(row.url);
        }
    }
    return uniqueUrls;
}

// Function to update the summary of a report
async function updateSummary(reportDirectory) {
    const summary = {};

    if (fs.existsSync(path.join(reportDirectory, 'report.csv'))) {
        const rows = await getCsvRows(path.join(reportDirectory, 'report.csv'));
        for (const row of rows) {
            for (const key in row) {
                if (!summary[key]) {
                    summary[key] = {};
                }
                
                // Initialize the value in the summary object if it does not exist
                if (!summary[key][row[key]]) {
                    summary[key][row[key]] = 0;
                }
                summary[key][row[key]]++;
            }
        }
    }

    return summary;
}

// Function to save a summary to a file
async function saveSummaryToFile(outputFilename, values) {
    const csvFilename = outputFilename.replace('.txt', '.csv');
    const data = [];
    for (const key in values) {
        data.push([key, values[key]]);
    }
    await saveCsvToFile(csvFilename, data);
}

async function saveUrlsToFile(outputFilename, count) {
    const csvFilename = outputFilename.replace('.txt', '.csv');
    await saveCsvToFile(csvFilename, [['Total Number of Unique URLs'], [count]]);
}

// Function to save a summary to a file
async function getCsvRows(csvFile) {
    const rows = [];
    return new Promise((resolve, reject) => {
        fs.createReadStream(csvFile)
            .pipe(csv())
            .on('data', (row) => {
                rows.push(row);
            })
            .on('end', () => {
                resolve(rows);
            })
            .on('error', (error) => {
                reject(error);
            });
    });
}

// Function to get all rows from a CSV file
async function getFirstRow(csvFile) {
    return new Promise((resolve, reject) => {
        fs.createReadStream(csvFile)
            .pipe(csv())
            .on('data', (row) => {
                resolve(row);
            })
            .on('end', () => {
                resolve(null);
            })
            .on('error', (error) => {
                reject(error);
            });
    });
}

// Function to save data to a CSV file
async function saveCsvToFile(filename, data) {
    return new Promise((resolve, reject) => {
        const output = [];
        for (const row of data) {
            output.push(row.join(','));
        }
        fs.writeFile(filename, output.join('\n'), 'utf-8', (error) => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });
}

// Main function execution
async function main() {
    const directory = process.argv[2] || './';
    const partialString = process.argv[3] || datetime;

    await findAndParseReports(directory, partialString);
}

// Execute the main function and log any errors
main().catch(console.error);

