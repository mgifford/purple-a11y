const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const { promisify } = require('util');
const readdir = promisify(fs.readdir);

const datetime = new Date().toISOString().slice(0, 10);

async function findAndParseReports(directory, partialString) {
    const subdirs = await readdir(directory);

    for (const subdir of subdirs) {
        if (subdir.includes(partialString)) {
            const reportDirectory = path.join(directory, subdir, 'reports');
            if (fs.existsSync(reportDirectory)) {
                const domain = await getDomainFromCsv(path.join(reportDirectory, 'report.csv'));
                const timestamp = subdir.split('_')[0];
                const outputFilenameBase = `${domain}_${timestamp}`;

                const summary = await updateSummary(reportDirectory);
                const uniqueUrls = await getUniqueUrls(path.join(reportDirectory, 'report.csv'));

                for (const column in summary) {
                    const outputFilename = `${outputFilenameBase}_${column}.txt`;
                    saveSummaryToFile(outputFilename, summary[column]);
                }

                const outputFilenameUrls = `${outputFilenameBase}_number_urls.txt`;
                saveUrlsToFile(outputFilenameUrls, uniqueUrls.size);
            }
        }
    }
}

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

function extractDomain(url) {
    return url.split('/')[2].replace(/\./g, '_');
}

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

async function updateSummary(reportDirectory) {
    const summary = {};

    if (fs.existsSync(path.join(reportDirectory, 'report.csv'))) {
        const rows = await getCsvRows(path.join(reportDirectory, 'report.csv'));
        for (const row of rows) {
            for (const key in row) {
                if (!summary[key]) {
                    summary[key] = {};
                }
                if (!summary[key][row[key]]) {
                    summary[key][row[key]] = 0;
                }
                summary[key][row[key]]++;
            }
        }
    }

    return summary;
}

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

async function saveCsvToFile(filename, data) {
    return new Promise((resolve, reject) => {
        const output = [];
        for (const row of data) {
            output.push(row.join(','));
        }
        fs.writeFile(filename, output
