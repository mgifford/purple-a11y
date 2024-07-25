const { google } = require('googleapis');
const fs = require('fs');
const { spawn, exec } = require('child_process');
const path = require('path');
const yaml = require('js-yaml');
const yargs = require('yargs');
const { parse } = require('csv-parse/sync');
const { readdir } = require('fs/promises');
const { parse: parseUrl } = require('url');
const { EventEmitter } = require('events');

// Set the max listeners to a higher value to avoid memory leak warnings
EventEmitter.defaultMaxListeners = 100;
process.setMaxListeners(90);

// Increase Puppeteer protocol timeout (adjust as necessary)
const PUPPETEER_TIMEOUT = 60000; // 60 seconds

const baseDir = path.resolve('/Users/mgifford/CA-Sitemap-Scans');
const TOKEN_PATH = path.join(baseDir, "token.json");
const CREDENTIALS_PATH = path.join(baseDir, "credentials.json");

const configFilePath = path.join(__dirname, 'unlighthouse-sites.yml');

// Define delay function
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function readConfig(url) {
    try {
        const configFileContent = fs.readFileSync(configFilePath, 'utf8');
        const config = yaml.load(configFileContent);
        for (const siteGroup of Object.values(config)) {
            for (const site of siteGroup) {
                if (site.url === url) {
                    // Default csv_directory if not defined
                    site.csv_directory = site.csv_directory || path.join(baseDir, '.unlighthouse');
                    return site;
                }
            }
        }
    } catch (e) {
        console.error('Error reading configuration file:', e.message);
        return null;
    }
    return null;
}

const argv = yargs
    .option('url', {
        description: 'Specify the URL to run the script for',
        type: 'string',
        demandOption: true
    })
    .help()
    .alias('help', 'h')
    .argv;

const specifiedUrl = argv.url;
const siteConfig = readConfig(specifiedUrl);

if (!siteConfig) {
    console.error(`No matching site found for URL: ${specifiedUrl}`);
    process.exit(1);
}

// console.log(`Processing URL: ${specifiedUrl}`);
// console.log(`Site configuration: ${JSON.stringify(siteConfig, null, 2)}`);

async function authenticateGoogleSheets() {
    console.log("Authenticating with Google Sheets...");
    const content = fs.readFileSync(CREDENTIALS_PATH, 'utf8');
    const credentials = JSON.parse(content);
    const oAuth2Client = new google.auth.OAuth2(credentials.installed.client_id, credentials.installed.client_secret, credentials.installed.redirect_uris[0]);
    const token = fs.readFileSync(TOKEN_PATH, 'utf8');
    oAuth2Client.setCredentials(JSON.parse(token));

    // Ensure the necessary scopes are set
    oAuth2Client.on('tokens', (tokens) => {
        if (tokens.refresh_token) {
            console.log('Refresh token received');
        }
        console.log('Access token received');
    });

    return oAuth2Client;
}

function parseCSV(filePath) {
    try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        return parse(fileContent, {
            columns: true,
            delimiter: ',',
            trim: true,
            skip_empty_lines: true,
            relax_column_count: true
        });
    } catch (error) {
        console.error(`Error parsing CSV file ${filePath}: ${error.message}`);
        if (error.code === 'CSV_RECORD_INCONSISTENT_COLUMNS') {
            console.error(`Malformed row data: ${error.record}`);
        }
        throw error;
    }
}


async function runUnlighthouse(url, timeout = 1800000) {
    console.log(`Running Unlighthouse for ${url}...`);
    const output = [];
    const startTime = new Date();
    const options = {
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        timeZoneName: 'short'
    };
    const formattedStartTime = new Intl.DateTimeFormat('en-US', options).format(startTime);
    console.log(`Start time for ${url}: ${formattedStartTime}`);

    const unlighthouse = spawn('npx', [
        'unlighthouse-ci',
        '--site', url,
        '--throttle',
        '--yes',
        '--reporter', 'csvExpanded',
        '--config', 'unlighthouse.config.ts,unlighthouse.config-cms.ts,unlighthouse.config-nsf.ts',
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
        '--expose-gc',
        '--timeout', '60000', // Set the timeout to 60 seconds
        '--protocol-timeout', '300000', // Increase the protocol timeout to 5 minutes
        '--navigation-timeout', '60000', // Increase the navigation timeout to 60 seconds
        '--log-level', 'error' // Adjust this according to Unlighthouse documentation
        // , '--no-sandbox',
    ]);

    // Set the max listeners to a higher value for the spawned process
    unlighthouse.stdout.setMaxListeners(50);
    unlighthouse.stderr.setMaxListeners(50);

    const handleData = data => {
        console.log(`[Unlighthouse Output for ${url}] ${data.toString()}`);
        output.push(data.toString());
    };

    const handleError = data => {
        console.error(`[Unlighthouse Error for ${url}] ${data}`);
        fs.appendFileSync('unlighthouse-error.log', data.toString());
    };

    unlighthouse.stdout.on('data', handleData);
    unlighthouse.stderr.on('data', handleError);

    const unlighthousePromise = new Promise((resolve, reject) => {
        unlighthouse.on('close', code => {
            const duration = (Date.now() - startTime) / 1000;
            unlighthouse.stdout.off('data', handleData);
            unlighthouse.stderr.off('data', handleError);
            if (code !== 0) {
                console.error(`Unlighthouse process for ${url} exited with code ${code} after ${duration} seconds.`);
                reject(new Error('Unlighthouse failed to complete successfully.'));
            } else {
                console.log(`Completed scanning ${url}. Duration: ${duration} seconds.`);
                resolve(output.join(''));
            }
        });
    });

    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
            console.log(`Handling timeout for ${url}, attempting to save results...`);
            savePartialResults(output);
            unlighthouse.stdout.off('data', handleData);
            unlighthouse.stderr.off('data', handleError);
            reject(new Error(`Unlighthouse process for ${url} timed out after ${timeout / 60000} minutes.`));
        }, timeout);
    });

    function savePartialResults(output) {
        console.log(`Saving partial results for ${url}: `, output);
    }

    return Promise.race([unlighthousePromise, timeoutPromise]).finally(() => {
        console.log(`Closing Chrome instances for ${url}...`);
        exec('pkill -f "Chrome Canary"');
    });
}


async function ensureSheetExists(auth, spreadsheetId, sheetName, index) {
    const sheets = google.sheets({ version: 'v4', auth }); // Ensure this is correctly instantiated
    try {
        const sheetMetadata = await sheets.spreadsheets.get({
            spreadsheetId,
            auth, // Added auth here
            fields: 'sheets.properties(sheetId,title)'  // Correct fields parameter
        });

        // Check if the sheet exists
        const existingSheet = sheetMetadata.data.sheets.find(sheet => sheet.properties.title === sheetName);

        // Don't delete the Summary sheet.
        if (sheetName == "Summary") {
            console.log(`Sheet "${sheetName}" exists and will not be deleted.`);
            return sheetName;
        }

        if (existingSheet) {
            // If the sheet exists and it is not the "Summary" sheet, delete it.
            console.log(`Deleting existing sheet with title "${sheetName}" and ID "${existingSheet.properties.sheetId}"`);
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                auth, // Added auth here
                resource: {
                    requests: [{
                        deleteSheet: {
                            sheetId: existingSheet.properties.sheetId
                        }
                    }]
                }
            });
            console.log(`Sheet "${sheetName}" deleted.`);
        }

        // Create the new sheet
        console.log(`Creating new sheet with title "${sheetName}" at index ${index}`);
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            auth, // Added auth here
            resource: {
                requests: [{
                    addSheet: {
                        properties: {
                            title: sheetName,
                            index: index  // Position to insert the new sheet
                        }
                    }
                }]
            }
        });
        console.log(`"${sheetName}" sheet created at position ${index + 1}.`);
    } catch (error) {
        console.error(`Error ensuring sheet exists: ${error.response ? JSON.stringify(error.response.data) : error.message}`);
        throw error; // Rethrow to handle in the calling context
    }

    return sheetName; // Ensure this is outside the if-else block
}


async function uploadToGoogleSheet(auth, spreadsheetId, values) {
    const sheets = google.sheets({ version: 'v4', auth });
    const today = new Date().toISOString().slice(0, 10); // Use the current date as the sheet title
    try {
        // Ensure the sheet with today's date exists (deletes if it already exists and creates new)
        console.log(`Ensuring sheet with title "${today}" exists in spreadsheet ID ${spreadsheetId}`);
        await ensureSheetExists(auth, spreadsheetId, today, 2);

        console.log(`Uploading data to the sheet: ${today}...`);

        await sheets.spreadsheets.values.append({
            spreadsheetId: spreadsheetId,
            range: `${today}!A1`,  // Update this range to point to the sheet with today's date and starting cell
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: values  // Ensure this is a list of lists. E.g., [[1, 2, 3], [4, 5, 6]]
            }
        });
        console.log('Data uploaded successfully to the sheet.');
    } catch (error) {
        console.error('Failed to upload data to the sheet:', error.response ? JSON.stringify(error.response.data) : error.message);
        if (error.response && error.response.data) {
            console.error('Error details:', JSON.stringify(error.response.data));
        }
        throw error;
    }
}

// Debugging memory usage
function logMemoryUsage() {
    if (global.gc) {
        global.gc();
    }
    const used = process.memoryUsage().heapUsed / 1024 / 1024;
    console.log(`The script uses approximately ${Math.round(used)} MB`);
}

function logError(domain, error) {
    const logsDir = path.join(__dirname, "logs");
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir);
    }
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, "0")}-${today.getDate().toString().padStart(2, "0")}`;
    const timeStr = `${today.getHours().toString().padStart(2, "0")}-${today.getMinutes().toString().padStart(2, "0")}-${today.getSeconds().toString().padStart(2, "0")}`;
    const sanitizedDomain = domain.replace(/[^a-zA-Z0-9]/g, "_"); // Sanitize the domain to be filesystem-safe
    const logFileName = `${sanitizedDomain}-${dateStr}-${timeStr}-error.log`;
    const logFilePath = path.join(logsDir, logFileName);

    const errorDetails = `Error: ${error.message}\nStack: ${error.stack}\n\n`;
    fs.appendFileSync(logFilePath, errorDetails);

    return logFilePath;
}

// Inserts today's date into the last cell of the "Summary" sheet
async function insertTodaysDateInSummarySheet(auth, spreadsheetId, url) {
    console.log(`insertTodaysDateInSummarySheet: Inserting today's date for URL: ${url}`);

    const sheets = google.sheets({ version: "v4", auth });

    try {
        // First, ensure that the "Summary" sheet exists
        await ensureSheetExists(auth, spreadsheetId, "Summary", 2);

        // Then, attempt to fetch the range to check if today's date already exists
        const range = "Summary!A:A";
        const result = await sheets.spreadsheets.values.get({ spreadsheetId, range });

        // Format today's date as YYYY-MM-DD
        const today = new Date();
        const formattedDate = today.toISOString().split("T")[0];
        console.log(`Today's date: ${formattedDate}`);

        // Check if formattedDate already exists in column A
        const existingDates = result.data.values ? result.data.values.flat() : [];
        if (existingDates.includes(formattedDate)) {
            console.log(`Today's date (${formattedDate}) exists in Summary sheet for ${url}`);
            return; // Skip insertion since the date already exists
        }

        // Date does not exist, find the first empty row
        const firstEmptyRow = existingDates.length + 1; // Add 1 to get the row number in Sheets

        // Update the first empty cell in column A with today's date
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `Summary!A${firstEmptyRow}`,
            valueInputOption: "USER_ENTERED",
            resource: {
                values: [[formattedDate]],
            },
        });

        console.log(`Inserted (${formattedDate}) into 1st empty row of the Summary sheet: ${url}`);
    } catch (err) {
        console.error("insertTodaysDateInSummarySheet: Error inserting today's date into the Summary sheet: ", err);
        const logFilePath = logError(spreadsheetId, err);
        console.error(`Error details can be found in ${logFilePath}`);
    }
}

async function getLatestCSVFile(directory) {
    const files = await readdir(directory);
    const csvFiles = files.filter(file => file === 'ci-result.csv');

    if (csvFiles.length === 0) {
        throw new Error('No CSV files found in the directory');
    }

    const latestCSVFile = csvFiles[0];
    const filePath = path.join(directory, latestCSVFile);
    const fileSizeInBytes = fs.statSync(filePath).size;
    const fileSizeInKB = (fileSizeInBytes / 1024).toFixed(2);

    const fileContent = fs.readFileSync(filePath, 'utf8');
    const records = parse(fileContent, {
        columns: true,
        delimiter: ',',
        trim: true,
        skip_empty_lines: true
    });
    const rowCount = records.length;

    console.log(`Latest CSV file: ${latestCSVFile}`);
    console.log(`File size: ${fileSizeInKB} KB`);
    console.log(`Number of rows: ${rowCount}`);
    logMemoryUsage();

    return filePath;
}


async function findRowByUrl(url, filePath) {
    try {
        console.log(`\n\n\nReading CSV file from: ${filePath}\n`);
        const records = await parseCSV(filePath);
        console.log(`Parsed ${records.length} records from the CSV file ${filePath}.`);

        const { hostname: inputHostname } = parseUrl(url);
        const normalizedInputHostname = inputHostname.replace(/^www\./, '').replace(/\/$/, '').toLowerCase();
        console.log(`Searching for domain: ${normalizedInputHostname}`);

        let matchedRecords = [];

        records.forEach((record, index) => {
            const targetUrl = record.target_url || record[0]; // Assuming target_url is the first column
            const baseDomain = record.base_domain || record[1]; // Assuming base_domain is the second column

            let normalizedTargetUrlHostname = null;
            let normalizedBaseDomain = null;

            // Log the values being checked for debugging
            // console.log(`Record ${index}: target_url: ${targetUrl}, base_domain: ${baseDomain}`);

            if (targetUrl) {
                if (targetUrl === normalizedInputHostname) {
                    console.log(`\n\nRecord ${index}: Target URL matches the input URL\n\n`);
                    matchedRecords.push(record);
                } else {
                    console.log(`Record ${index}: url: ${normalizedInputHostname} -=- target_url: ${targetUrl} - ${record.target_url}, alternate (likely null): ${record[0]}`);
                }

                const parsedTargetUrl = parseUrl(targetUrl);
                if (parsedTargetUrl.hostname) {
                    normalizedTargetUrlHostname = parsedTargetUrl.hostname.replace(/^www\./, '').replace(/\/$/, '');
                    console.log(`Record ${index}: Normalized target URL hostname: ${normalizedTargetUrlHostname}`);
                }
            } else {
                console.log(`Record ${index}: Target URL is missing`);
            }

            if (baseDomain) {
                if (baseDomain === normalizedInputHostname) {
                    console.log(`\n\nRecord ${index}: Base URL matches the input URL\n\n`);
                    matchedRecords.push(record);
                } else {
                    console.log(`Record ${index}: url: ${normalizedInputHostname} -=-  base_domain: ${baseDomain} - ${record.base_domain}, alternate (likely null): ${record[1]}`);
                }

                normalizedBaseDomain = baseDomain.replace(/^www\./, '').replace(/\/$/, '');
                // console.log(`Record ${index}: Normalized base domain: ${normalizedBaseDomain}`);
            } else {
                // console.log(`Record ${index}: Base domain is missing`);
            }

            /* if (normalizedTargetUrlHostname === normalizedInputHostname || normalizedBaseDomain === normalizedInputHostname) {
                matchedRecords.push(record);
                console.log(`\n\nMatched Records ${record} \n\n`);
            } */

        });

        console.log(`Matched records count: ${matchedRecords.length}`);
        if (matchedRecords.length > 0) {
            // console.log(`Row found for domain: ${normalizedInputHostname}`);
            console.log(matchedRecords[0]);
            return matchedRecords[0];
        } else {
            console.log(`No row found for domain: ${normalizedInputHostname}`);
            return null;
        }
    } catch (error) {
        console.error(`Error while searching for domain in CSV: ${error.message}`);
        throw error;
    }
}


module.exports = findRowByUrl;

// Function to convert a number to a column letter (1 -> A, 27 -> AA, etc.)
function getColumnLetter(index) {
    let letter = '';
    while (index > 0) {
        const mod = (index - 1) % 26;
        letter = String.fromCharCode(65 + mod) + letter;
        index = Math.floor((index - mod) / 26);
    }
    return letter;
}

async function appendToGoogleSheet(auth, spreadsheetId, sheetName, row) {
    const sheets = google.sheets({ version: 'v4', auth });
    const values = [Object.values(row)];

    // Calculate the last column based on the length of the data
    const lastColumn = getColumnLetter(values[0].length);
    const range = `${sheetName}!A500:${lastColumn}500`; // Define the range dynamically

    try {
        console.log(`Appending data to ${range} in spreadsheet ID ${spreadsheetId}`);
        console.log(`Data to be appended: ${JSON.stringify(values)}`);

        const response = await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: range,
            valueInputOption: 'USER_ENTERED',
            resource: { values }
        });

        console.log(`Data appended successfully. Response: ${JSON.stringify(response.data)}`);
    } catch (error) {
        console.error(`Failed to append data to ${range}:`, error.message);
        console.error(`Stack trace: ${error.stack}`);
        if (error.response) {
            console.error(`Error details: ${JSON.stringify(error.response.data)}`);
        }
        throw error;
    }
}


async function processUrl(url, config) {
    console.log(`Running Unlighthouse for ${url} with config:`);
    console.log(config);

    try {
        const unlightOutput = await runWithRetry(url);
        const csvFilePath = path.join(config.csv_directory, 'ci-result.csv');

        // Ensure the CSV file exists
        if (!fs.existsSync(csvFilePath)) {
            throw new Error(`CSV file not found at path: ${csvFilePath}`);
        }

        const csvData = parseCSV(csvFilePath);
        const headers = Object.keys(csvData[0]);
        const formattedData = [headers, ...csvData.map(row => headers.map(header => row[header] || ''))];

        const auth = await authenticateGoogleSheets().catch(error => {
            console.error(`Error during Google Sheets authentication for ${url}:`, error);
            throw error;
        });

        const sheetName = await ensureSheetExists(auth, config.sheet_id, new Date().toISOString().slice(0, 10), 2).catch(error => {
            console.error(`Error ensuring sheet exists for ${url}:`, error);
            throw error;
        });

        if (sheetName) {
            let row = await findRowByUrl(url, csvFilePath);
            if (row) {
                await appendToGoogleSheet(auth, config.sheet_id, 'Introduction', row);
                console.log(`Row appended to Google Sheet for ${url}`);
            } else {
                console.log(`URL ${url} not found in CSV`);
            }

            await uploadToGoogleSheet(auth, config.sheet_id, formattedData).catch(error => {
                console.error(`Error uploading to Google Sheet for ${url}:`, error);
                throw error;
            });
            console.log(`Data uploaded successfully for ${url}.`);

            await insertTodaysDateInSummarySheet(auth, config.sheet_id, url);
        } else {
            console.log(`Sheet name is empty for ${url}`);
        }
    } catch (error) {
        console.error(`An error occurred while processing ${url}:`, error);
    }
}


async function runWithRetry(url, retries = 3, timeout = 1800000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`Attempt ${attempt} to run Unlighthouse for ${url}`);
            return await runUnlighthouse(url, timeout);
        } catch (error) {
            console.error(`Attempt ${attempt} for ${url} failed: ${error.message}`);
            if (attempt < retries) {
                const delayTime = Math.pow(2, attempt) * 1000; // Exponential backoff
                console.log(`Retrying ${url} after ${delayTime / 1000} seconds...`);
                await delay(delayTime);
            } else {
                console.error(`All ${retries} attempts for ${url} failed.`);
                throw error; // Ensure to throw the error if all attempts fail
            }
        }
    }
}


async function main() {
    const argv = yargs
        .option('url', {
            description: 'Specify the URL to run the script for',
            type: 'string',
            demandOption: true
        })
        .help()
        .alias('help', 'h')
        .argv;

    const specifiedUrl = argv.url;
    const siteConfig = readConfig(specifiedUrl);

    if (!siteConfig) {
        console.error(`No matching site found for URL: ${specifiedUrl}`);
        process.exit(1);
    }

    console.log(`Processing URL: ${specifiedUrl}`);
    console.log(`Site configuration: ${JSON.stringify(siteConfig, null, 2)}`);

    try {
        await processUrl(specifiedUrl, siteConfig).catch(error => {
            console.error('Unhandled error in processUrl:', error);
            process.exit(1);  // Exit with error code
        });
        process.exit(0);  // Exit with success code
    } catch (error) {
        console.error('Unhandled error in main:', error);
        process.exit(1);  // Exit with error code
    }
}

main().catch(error => {
    console.error('Unhandled error in main:', error);
    process.exit(1);  // Exit with error code
});
