const { google } = require('googleapis');
const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');
const yaml = require('js-yaml');
const { parse } = require('csv-parse/sync');


// Set up some file paths and global variables
const baseDir = path.resolve(__dirname);
const TOKEN_PATH = path.join(baseDir, "token.json");
const CREDENTIALS_PATH = path.join(baseDir, "credentials.json");
// const configFilePath = path.join(baseDir, "unlighthouse_sites.yml");



function readConfig() {
    console.log("Reading configuration file...");
    const configFileContent = fs.readFileSync('unlighthouse_sites.yml', 'utf8');
    const config = yaml.load(configFileContent);
    if (!config) {
        throw new Error("Configuration file is missing or empty");
    }

    const sites = [];
    for (const [url, entries] of Object.entries(config)) {
        entries.forEach(entry => {
            sites.push({
                url: url,
                ...entry
            });
        });
    }

    if (sites.length === 0) {
        throw new Error("No sites found in configuration");
    }

    console.log(`Loaded ${sites.length} sites from configuration.`);
    return sites;
}

// Authenticate with Google Sheets
async function authenticateGoogleSheets() {
    console.log("Authenticating with Google Sheets...");
    const content = fs.readFileSync(CREDENTIALS_PATH, 'utf8');
    const credentials = JSON.parse(content);
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    let token;
    try {
        token = fs.readFileSync(TOKEN_PATH, 'utf8');
    } catch (error) {
        console.error("Error reading token file:", error);
        throw new Error("Authentication failed. Token file not found.");
    }

    oAuth2Client.setCredentials(JSON.parse(token));
    return oAuth2Client;
}

// Check if a Google Sheet exists and create one if it doesn't
async function ensureSheetExists(auth, siteName) {
    const sheets = google.sheets({ version: 'v4', auth });
    try {
        console.log(`Creating new sheet for ${siteName}...`);
        const response = await sheets.spreadsheets.create({
            resource: {
                properties: {
                    title: siteName  // Correctly place the title within the properties object in the body of the request
                }
            }
        });
        console.log(`Created new sheet for ${siteName}: ${response.data.spreadsheetId}`);
        return response.data.spreadsheetId;
    } catch (error) {
        console.error("Failed to create new sheet:", error);
        throw error;
    }
}



// Function to parse CSV
function parseCSV(filePath) {
    try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        return parse(fileContent, {
            columns: true,
            skip_empty_lines: true,
            relax_column_count: true,
            trim: true,
        });
    } catch (error) {
        console.error("Error parsing CSV file:", error.message);
        return []; // Return an empty array or handle accordingly
    }
}

// Run Unlighthouse and capture its output
async function runUnlighthouse(url) {
    console.log(`Running Unlighthouse for ${url}...`);
    return new Promise((resolve, reject) => {
        const output = [];
        const unlighthouse = spawn('npx', [
            'unlighthouse-ci',
            '--no-cache',
            '--site', url,
            '--throttle',
            '--reporter', 'csvExpanded'
        ]);

        unlighthouse.stdout.on('data', (data) => {
            console.log(data.toString());
            output.push(data.toString());
        });

        unlighthouse.stderr.on('data', (data) => {
            console.error(`Error: ${data}`);
        });

        unlighthouse.on('close', (code) => {
            if (code !== 0) {
                console.error(`Unlighthouse process exited with code ${code}`);
                reject(new Error('Unlighthouse failed to complete successfully.'));
            } else {
                resolve(output.join(''));
            }
        });
    });
}

// Function to upload data to a specific sheet
async function uploadToGoogleSheet(auth, sheetId, values) {
    const sheets = google.sheets({ version: 'v4', auth });
    try {
        await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: 'Sheet1', // Specify the sheet name and range
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: values
            }
        });
        console.log('Data uploaded successfully.');
    } catch (error) {
        console.error('Failed to upload data:', error);
        throw error;
    }
}

// Main function to run the workflow
async function main() {
    try {
        const sites = readConfig();
        const auth = await authenticateGoogleSheets();

        for (const site of sites) {
            console.log(`Processing site: ${site.url}`);
            await runUnlighthouse(site.url); // Run Unlighthouse and assume it saves the result as 'ci-result.csv'

            const csvData = parseCSV('./.unlighthouse/ci-result.csv'); // Adjust path as necessary
            console.log(`Parsed CSV Data for ${site.url}:`, csvData);

            const formattedData = csvData.map(row => Object.values(row)); // Format data for Sheets
            await uploadToGoogleSheet(auth, site.sheet_id, formattedData);
        }
    } catch (error) {
        console.error("An error occurred:", error);
    }
}

main();
