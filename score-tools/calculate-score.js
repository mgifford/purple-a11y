import fs from 'fs';
import csv from 'fast-csv';
import path from 'path';

function calculateScore(data, numberUrls) {
    if (numberUrls === 0) return 0;
    const score = ((data.critical || 0) * 3 + (data.serious || 0) * 2 + (data.moderate || 0) * 1.5 + (data.minor || 0)) / (numberUrls * 5);
    return Math.round(score * 10000) / 10000;
}

function calculateGrade(score) {
    let grade;
    let message = "Automated testing feedback: ";

    if (score === 0) {
        grade = "A+";
        message += "No axe errors, great! Have you tested with a screen reader?";
    } else if (score <= 0.1) {
        grade = "A";
        message += "Very few axe errors left! Don't forget manual testing.";
    } else if (score <= 0.3) {
        grade = "A-";
        message += "So close to getting the automated errors! Remember keyboard-only testing.";
    } else if (score <= 0.5) {
        grade = "B+";
        message += "More work to eliminate automated testing errors. Have you tested zooming in 200% with your browser?";
    } else if (score <= 0.7) {
        grade = "B";
        message += "More work to eliminate automated testing errors. Are the text alternatives meaningful?";
    } else if (score <= 0.9) {
        grade = "B-";
        message += "More work to eliminate automated testing errors. Don't forget manual testing.";
    } else if (score <= 2) {
        grade = "C+";
        message += "More work to eliminate automated testing errors. Have you tested in grayscale to see if color isn't conveying meaning?";
    } else if (score <= 4) {
        grade = "C";
        message += "More work to eliminate automated testing errors. Have you checked if gradients or background images are making it difficult to read text?";
    } else if (score <= 6) {
        grade = "C-";
        message += "More work to eliminate automated testing errors. Don't forget manual testing.";
    } else if (score <= 11) {
        grade = "D+";
        message += "A lot more work to eliminate automated testing errors. Most WCAG success criteria can be fully automated.";
    } else if (score <= 14) {
        grade = "D";
        message += "A lot more work to eliminate automated testing errors. Don't forget manual testing.";
    } else if (score <= 17) {
        grade = "D-";
        message += "A lot more work to eliminate automated testing errors. Can users navigate your site without using a mouse?";
    } else if (score <= 20) {
        grade = "F+";
        message += "A lot more work to eliminate automated testing errors. Are there keyboard traps that stop users from navigating the site?";
    } else {
        grade = "F";
        message += "A lot more work to eliminate automated testing errors. Considerable room for improvement.";
    }

    return [grade, message];
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
    try {
        const { axeImpactFile, numberUrlsFile, wcagConformanceFile, urlFile, xpathFile, outputFileName } = files;

        // ... [rest of the processAndAppend function as before]

        console.log(`Processed: ${outputFileName}`);
    } catch (error) {
        console.error(`Error in processAndAppend: ${error.message}`);
    }
}

async function main() {
    const inputDirectory = './'; // Replace with desired directory path

    try {
        const files = await fs.promises.readdir(inputDirectory);

        for (const file of files) {
            if (file.endsWith("_axeImpact.csv")) {
                const baseName = file.replace("_axeImpact.csv", "");
                const filesToProcess = {
                    axeImpactFile: path.join(inputDirectory, file),
                    numberUrlsFile: path.join(inputDirectory, `${baseName}_number_urls.csv`),
                    wcagConformanceFile: path.join(inputDirectory, `${baseName}_wcagConformance.csv`),
                    urlFile: path.join(inputDirectory, `${baseName}_url.csv`),
                    xpathFile: path.join(inputDirectory, `${baseName}_xpath.csv`),
                    outputFileName: `${baseName}_result.csv`
                };

                await processAndAppend(filesToProcess, inputDirectory);
            }
        }
    } catch (error) {
        console.error(`Error in main: ${error.message}`);
    }
}

main().catch(console.error);
