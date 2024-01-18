const fs = require('fs');
const csv = require('fast-csv');
const path = require('path');

function calculateScore(data, numberUrls) {
    if (numberUrls === 0) return 0;
    const score = ((data.critical || 0) * 3 + (data.serious || 0) * 2 + (data.moderate || 0) * 1.5 + (data.minor || 0)) / (numberUrls * 5);
    return Math.round(score * 10000) / 10000;
}

function calculateGrade(score) {
    // Similar grading logic as in Python script
    // Returns [grade, message]
}

function readCsv(filePath) {
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath)
            .pipe(csv.parse({ headers: true }))
            .on('data', (row) => results.push(row))
            .on('end', () => resolve(results))
            .on('error', (error) => reject(error));
    });
}

async function processAndAppend(files, outputDirectory) {
    // Similar logic as in the Python script
    // Includes reading CSV files, calculating scores and grades, and writing results
}

async function main() {
    const inputDirectory = './'; // Replace with desired directory path
    // Logic to find and process relevant CSV files
}

main().catch(console.error);
