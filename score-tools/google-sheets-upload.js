const fs = require('fs');
const fsPromises = require('fs').promises;

const readline = require('readline');
const {
    google
} = require('googleapis');
const yaml = require('js-yaml');
const path = require('path');
const util = require('util');
const {
    parse
} = require('csv-parse');
const exec = util.promisify(require('child_process').exec);

const TOKEN_PATH = 'token.json';
const CREDENTIALS_PATH = 'credentials.json';
const YAML_CONFIG = 'google-crawl.yml';

const crypto = require('crypto');

function generateMD5Hash(input) {
    return crypto.createHash('md5').update(input).digest('hex');
}

// Load client secrets from a local file.
fs.readFile(CREDENTIALS_PATH, (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    authorize(JSON.parse(content), manageSheets);
});


/**
 * Create an OAuth2 client with the given credentials, and then execute the callback function.
 */
function authorize(credentials, callback) {
    const {
        client_secret,
        client_id,
        redirect_uris
    } = credentials.installed || credentials.web;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) {
            return getNewToken(oAuth2Client, callback);
        } else {
            oAuth2Client.setCredentials(JSON.parse(token));
            callback(oAuth2Client);
        }
    });
}

function getNewToken(oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    console.log('Authorize this app by visiting this URL:', authUrl);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
            if (err) return console.error('Error retrieving access token', err);
            oAuth2Client.setCredentials(token);
            fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                if (err) return console.error(err);
                console.log('Token stored to', TOKEN_PATH);
            });
            callback(oAuth2Client);
        });
    });
}


async function manageSheets(auth) {
    const sheets = google.sheets({
        version: 'v4',
        auth
    });
    let config = loadConfig();

    for (const [site, entries] of Object.entries(config)) {

        // console.log(`Manage Site ${site}: ${entry.url}`);

        for (let entry of entries) {
            console.log(`Manage Site ${site}: ${entry.url}`);

            // Ensure each site entry has a dedicated Google Sheet
            if (!entry.sheet_id) {
                const response = await sheets.spreadsheets.create({
                    resource: {
                        properties: {
                            title: entry.name
                        }
                    },
                    fields: 'spreadsheetId',
                });
                const sheetId = response.data.spreadsheetId;
                const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}`;

                entry.sheet_id = sheetId;
                entry.sheet_url = sheetUrl;
                console.log(`Created new sheet for ${site}: ${entry.url}`);
            }
            // console.log(`Current sheet ID ${entry.sheet_id} - ${entry.sheet_url} - ${entry.url}`);

            console.log(`Current Google Sheet URL ${entry.sheet_url}`);


            // uncomment this if the rest is working
            insertTodaysDateInSummarySheet(auth, entry.sheet_id); // Insert today's date in the Summary sheet

            // Define the command to run purple-a11y
            const command = `node purple-a11y/cli.js -u ${entry.url} -c 2 -p 1000 -k "mike gifford:mike.gifford@civicactions.com"`;
            try {
                // Execute the purple-a11y command
                console.log('Running command:', command);
                const {
                    stdout,
                    stderr
                } = await exec(command, {
                    maxBuffer: 1024 * 1024 * 5
                }); // Increase to 5MB
                console.log(`Command completed for URL: ${entry.url}`);
            } catch (error) {
                console.error('Error executing command for URL:', entry.url, error);
                continue; // Skip further processing for this entry if the command fails
            }

            // Process the results and update the Google Sheet
            try {
                // Find the most recent directory in the ./results/ directory
                const mostRecentDir = getMostRecentDirectory('./results');
                const reportPath = path.join('./results', mostRecentDir, 'reports', 'report.csv');
                // console.log('Uploading report path:', reportPath);

                // Process the CSV report and prepare data
                // const summary = await analyzeCsvData(reportPath);

                // await updateSummarySheet(auth, entry.sheet_id, summary);  

                // Optionally, call prepareDataForUpload if you need to process CSV data
                const processedRecords = await prepareDataForUpload(reportPath);

                // console.log('After prepareDataForUpload:', processedRecords);


                // Upload the processed CSV report to the Google Sheet
                // await uploadToGoogleSheet(auth, entry.sheet_id, reportPath); // Adjust the argument if using processedRecords
                await uploadToGoogleSheet(auth, entry.sheet_id, processedRecords);

            } catch (error) {
                console.error('Error processing and uploading data for URL:', entry.url, error);
            }
        }
    }

    // Save updated config back to YAML after all processing
    saveConfig(config);
}



function getMostRecentDirectory(basePath) {
    const dirs = fs.readdirSync(basePath, {
            withFileTypes: true
        })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => ({
            name: dirent.name,
            time: fs.statSync(path.join(basePath, dirent.name)).mtime.getTime()
        }))
        // Sort directories by modified time descending
        .sort((a, b) => b.time - a.time);

    // Return the name of the most recent directory
    if (dirs.length > 0) {
        return dirs[0].name;
    } else {
        throw new Error('No directories found in basePath');
    }
}

// Helper function to parse CSV data asynchronously
function parseCSV(data) {
    return new Promise((resolve, reject) => {
        parse(data, {
            columns: true,
            skip_empty_lines: true,
        }, (err, output) => {
            if (err) {
                reject(err);
            } else {
                resolve(output);
            }
        });
    });
}




/**
 * Cleans a cell by removing unnecessary quotes and trimming spaces.
 *
 * @param {string} cell The cell content to clean.
 * @returns {string} The cleaned cell content.
 */
function cleanCell(cell) {
    let cleanedCell = cell.replace(/^"|"$/g, '').trim(); // Remove surrounding quotes
    cleanedCell = cleanedCell.replace(/""/g, '"'); // Replace double quotes with single
    return cleanedCell;
}

/**
 * Uploads data from a CSV file to a Google Sheet, creating or updating sheets as necessary.
 * 
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth2 client.
 * @param {string} spreadsheetId The ID of the spreadsheet to update.
 * @param {string} filePath The path to the CSV file containing the data to upload.
 */



async function uploadToGoogleSheet(auth, spreadsheetId, processedRecords) {
    // console.log('Enter uploadToGoogleSheet:', processedRecords);

    const sheets = google.sheets({
        version: 'v4',
        auth
    });
    try {
        const values = processedRecords.map(record => [
            record.severity,
            record.issueId,
            record.wcagConformance,
            record.url,
            record.context,
            record.axeImpact,
            record.xpath,
            record.md5Hash // Make sure each of these fields exists in your record object
        ]);
        // console.log('Values in uploadToGoogleSheet:', values);

        // Construct the sheet name based on today's date
        const today = new Date();
        const sheetName = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;

        // Check if the sheet exists, and if not, create it
        const sheetMetadata = await sheets.spreadsheets.get({
            spreadsheetId,
            fields: 'sheets(properties.title)'
        });
        const sheetTitles = sheetMetadata.data.sheets.map(sheet => sheet.properties.title);
        if (!sheetTitles.includes(sheetName)) {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                resource: {
                    requests: [{
                        addSheet: {
                            properties: {
                                title: sheetName
                            }
                        }
                    }]
                }
            });
        }

        // Append the data to the sheet
        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${sheetName}!A1`,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values
            }
        });
        console.log(`Uploaded data to '${sheetName}' in spreadsheet: ${spreadsheetId}`);
    } catch (err) {
        console.error('Error uploading data to Google Sheets:', err);
    }
}




/**
 * Analyzes CSV data from a specified file path to aggregate accessibility issue data.
 * 
 * @param {string} filePath The path to the CSV file to be analyzed.
 * @returns {Object} A summary object containing counts and details of accessibility issues found.
 */
/*
  async function analyzeCsvData(filePath) {
    console.log(`Starting analysis of CSV data from: ${filePath}`);

    // Initialize a summary object to hold counts and details of various accessibility issues
    let summary = {
        url_count: new Set(),
        issueId_count: new Set(),
        severity_count: new Set(),
        context_count: new Set(),
        axeImpact_count: new Set(),
        xpath_count: new Set(),
        axeImpact_critical: 0,
        axeImpact_serious: 0,
        axeImpact_moderate: 0,
        axeImpact_minor: 0,
        wcagConformance_wcag143: 0,
        wcagConformance_wcag131: 0,
        wcagConformance_best_practice: 0
    };

    // Attempt to read the CSV file content
    let content;
    try {
        content = await fs.promises.readFile(filePath, 'utf8');
    } catch (error) {
        console.error(`Error reading file at ${filePath}:`, error);
        return summary; // Return early with the initial summary structure
    }

    // Attempt to parse the CSV content
    let records;
    try {
        records = await parse(content, { columns: true, skip_empty_lines: true });
    } catch (parseError) {
        console.error(`Error parsing CSV content from ${filePath}:`, parseError);
        return summary; // Return early with whatever was accumulated before the error
    }

    // Process each record in the parsed CSV data
    records.forEach((record, index) => {
        try {
            // Aggregate information about issues found across different URLs, severities, etc.
            summary.url_count.add(record.url);
            summary.issueId_count.add(record.issueId);
            summary.severity_count.add(record.severity);
            summary.context_count.add(record.context);
            summary.axeImpact_count.add(record.axeImpact);
            summary.xpath_count.add(record.xpath);

            // Increment counts based on the axe impact level
            switch (record.axeImpact) {
                case 'critical':
                    summary.axeImpact_critical++;
                    break;
                case 'serious':
                    summary.axeImpact_serious++;
                    break;
                case 'moderate':
                    summary.axeImpact_moderate++;
                    break;
                case 'minor':
                    summary.axeImpact_minor++;
                    break;
            }

            // Increment counts based on the WCAG conformance tags
            const wcagTags = record.wcagConformance.split(',');
            wcagTags.forEach(tag => {
                switch (tag.trim()) {
                    case 'wcag143':
                        summary.wcagConformance_wcag143++;
                        break;
                    case 'wcag131':
                        summary.wcagConformance_wcag131++;
                        break;
                    case 'best-practice':
                        summary.wcagConformance_best_practice++;
                        break;
                }
            });
        } catch (recordError) {
            console.error(`Error processing record #${index + 1} in ${filePath}:`, recordError);
        }
    });

    // Debug info before conversion
    console.log(`Summary before converting Set sizes to numbers for ${filePath}:`, JSON.stringify(summary, null, 2));

    // Convert Set sizes to numbers for the final summary to make it easier to read and interpret
    summary.url_count = summary.url_count.size;
    summary.issueId_count = summary.issueId_count.size;
    summary.severity_count = summary.severity_count.size;
    summary.context_count = summary.context_count.size;
    summary.axeImpact_count = summary.axeImpact_count.size;
    summary.xpath_count = summary.xpath_count.size;

    return summary;
}
*/

async function prepareDataForUpload(filePath) {
    // console.log('Enter prepareDataForUpload:', filePath);
    try {
        // Correctly use fsPromises.readFile to read the file content asynchronously
        const fileContent = await fsPromises.readFile(filePath, 'utf8');
        // Process the CSV content
        const records = await parseCSV(fileContent);
        const processedRecords = records.map(record => ({
            severity: record.severity,
            issueId: record.issueId,
            wcagConformance: record.wcagConformance,
            url: record.url,
            context: record.context,
            axeImpact: record.axeImpact,
            xpath: record.xpath,
            md5Hash: generateMD5Hash(`${record.url}${record.xpath}`),
        }));
        // console.log('Processed Records:', processedRecords);
        return processedRecords;
    } catch (error) {
        console.error('Error preparing data for upload:', error);
        throw error; // Rethrow the error to handle it further up the call stack
    }
}




function loadConfig() {
    try {
        return yaml.load(fs.readFileSync(YAML_CONFIG, 'utf8'));
    } catch (e) {
        console.error(e);
        return {};
    }
}

function saveConfig(config) {
    try {
        fs.writeFileSync(YAML_CONFIG, yaml.dump(config), 'utf8');
        console.log('Updated YAML configuration saved.');
    } catch (e) {
        console.error('Failed to save the updated configuration:', e);
    }
}




async function updateSummarySheet(auth, spreadsheetId, summaryData) {
    const sheets = google.sheets({
        version: 'v4',
        auth
    });
    try {
        // Ensure "Summary" sheet exists or create it
        await ensureSheetExists(sheets, spreadsheetId, 'Summary');

        // Append summary data to "Summary" sheet
        const range = 'Summary!A:Z'; // Assuming summary fits within columns A to Z
        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [Object.values(summaryData)]
            },
        });
        console.log('Summary data updated.');
    } catch (error) {
        console.error('Failed to update summary sheet:', error);
    }
}


async function ensureSheetExists(sheets, spreadsheetId, sheetTitle) {
    const sheetMetadata = await sheets.spreadsheets.get({
        spreadsheetId
    });
    const sheetExists = sheetMetadata.data.sheets.some(sheet => sheet.properties.title === sheetTitle);

    if (!sheetExists) {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            resource: {
                requests: [{
                    addSheet: {
                        properties: {
                            title: sheetTitle
                        }
                    }
                }],
            },
        });
    }
}

async function insertTodaysDateInSummarySheet(auth, spreadsheetId) {
    const sheets = google.sheets({
        version: 'v4',
        auth
    });
    try {
        // Get the range of column A in the Summary sheet to find the first empty row
        const range = 'Summary!A:A';
        const result = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
        });

        // Find the first empty row (if the cell is empty, it won't be included in values)
        const numRows = result.data.values ? result.data.values.length : 0;
        const firstEmptyRow = numRows + 1; // Add 1 because array is 0-indexed but Sheets rows start from 1

        // Format today's date as YYYY-MM-DD
        const today = new Date();
        const formattedDate = today.toISOString().split('T')[0];

        // Update the first empty cell in column A with today's date
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `Summary!A${firstEmptyRow}`,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [
                    [formattedDate]
                ],
            },
        });

        console.log(`Inserted today's date (${formattedDate}) into the first empty row of the Summary sheet.`);
    } catch (err) {
        console.error('Error inserting today\'s date into the Summary sheet:', err);
    }
}
