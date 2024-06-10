const { google } = require('googleapis');
const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');
const yaml = require('js-yaml');
const yargs = require('yargs');
const { parse } = require('csv-parse/sync');

const baseDir = path.resolve(__dirname);
const TOKEN_PATH = path.join(baseDir, "token.json");
const CREDENTIALS_PATH = path.join(baseDir, "credentials.json");

function readConfig(configFilePath = 'unlighthouse_sites.yml') {
    console.log(`Reading configuration file from ${configFilePath}...`);
    const configFileContent = fs.readFileSync(configFilePath, 'utf8');
    const config = yaml.load(configFileContent);
    const sites = [];
    for (const [url, entries] of Object.entries(config)) {
        entries.forEach(entry => sites.push({ url, ...entry }));
    }
    console.log(`Loaded ${sites.length} sites from configuration.`);
    return sites;
}

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
    const fileContent = fs.readFileSync(filePath, 'utf8');
    return parse(fileContent, { columns: true, skip_empty_lines: true, relax_column_count: true, trim: true });
}

require('events').EventEmitter.defaultMaxListeners = 50;  // Increase the listener limit


async function runUnlighthouse(url) {
    console.log(`Running Unlighthouse for ${url}...`);
    const output = [];
    const startTime = Date.now();  // Record the start time

    const unlighthouse = spawn('npx', [
        'unlighthouse-ci',
        '--no-cache',
        '--site', url,
        '--throttle',
        '--timeout', '180000',  // Increase timeout to 180 seconds (3 minutes)
        '--reporter', 'csvExpanded',
        '--config', 'unlighthouse.config.js'
    ]);

    unlighthouse.stdout.on('data', data => {
        console.log(`[Unlighthouse Output] ${data.toString()}`);
        output.push(data.toString());
    });

    unlighthouse.stderr.on('data', data => {
        console.error(`[Unlighthouse Error] ${data}`);
    });

    return new Promise((resolve, reject) => {
        unlighthouse.on('close', code => {
            const duration = (Date.now() - startTime) / 1000; // Calculate the duration in seconds
            if (code !== 0) {
                console.error(`Unlighthouse process for ${url} exited with code ${code} after ${duration} seconds.`);
                reject(new Error('Unlighthouse failed to complete successfully.'));
            } else {
                console.log(`Completed scanning ${url}. Duration: ${duration} seconds.`);
                resolve(output.join(''));
            }
        });
    });
}




async function ensureSheetExists(sheets, spreadsheetId, sheetName, index) {
    try {
        const sheetMetadata = await sheets.spreadsheets.get({
            spreadsheetId,
            fields: 'sheets.properties(sheetId, title)'  // Correct fields parameter
        });

        // Check if the sheet exists
        const existingSheet = sheetMetadata.data.sheets.find(sheet => sheet.properties.title === sheetName);

        if (existingSheet) {
            // If the sheet exists, delete it
            console.log(`Deleting existing sheet with title "${sheetName}" and ID "${existingSheet.properties.sheetId}"`);
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
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


async function getSheetTitleByIndex(sheets, spreadsheetId, index) {
    try {
        const response = await sheets.spreadsheets.get({
            spreadsheetId,
            fields: 'sheets(properties(title, index))'
        });

        if (!response.data.sheets) {
            throw new Error(`No sheets found in spreadsheet with ID ${spreadsheetId}`);
        }

        const sheet = response.data.sheets.find(sheet => sheet.properties.index === index);
        if (sheet) {
            return sheet.properties.title;
        } else {
            throw new Error(`No sheet found at index ${index}`);
        }
    } catch (error) {
        console.error('Failed to get sheet title by index:', error.response ? error.response.data : error.message);
        throw error;
    }
}


async function uploadToGoogleSheet(auth, spreadsheetId, values) {
    const sheets = google.sheets({ version: 'v4', auth });
    const today = new Date().toISOString().slice(0, 10); // Use the current date as the sheet title
    try {
        // Ensure the sheet with today's date exists (deletes if it already exists and creates new)
        console.log(`Ensuring sheet with title "${today}" exists in spreadsheet ID ${spreadsheetId}`);
        await ensureSheetExists(sheets, spreadsheetId, today, 2);

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
        throw error;
    }
}



// Debugging memory usage
function logMemoryUsage() {
    const used = process.memoryUsage().heapUsed / 1024 / 1024;
    console.log(
      `The script uses about ${Math.round(used)} MB`,
    );
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
  
    const sheets = google.sheets({version: "v4", auth});
  
    try {
      // First, ensure that the "Summary" sheet exists
      await ensureSheetExists(sheets, spreadsheetId, "Summary", 2);
  
      // Then, attempt to fetch the range to check if today's date already exists
      const range = "Summary!A:A";
      const result = await sheets.spreadsheets.values.get({spreadsheetId, range});
  
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
      logMemoryUsage();
    } catch (err) {
      console.error("insertTodaysDateInSummarySheet: Error inserting today's date into the Summary sheet: ", err);
      const logFilePath = logError(spreadsheetId, err);
      console.error(`Error details can be found in ${logFilePath}`);
    }
  }

async function main() {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const yargs = require('yargs');

    const argv = yargs
        .option('y', {
            alias: 'yaml',
            description: 'Specify the YAML configuration file',
            type: 'string',
            default: 'unlighthouse_sites.yml'
        })
        .option('d', {
            alias: 'day',
            description: 'Specify the day to run the sites',
            type: 'string',
            default: new Date().toLocaleDateString('en-US', { weekday: 'long' })
        })
        .help()
        .alias('help', 'h')
        .argv;
    
    const configFile = argv.yaml;
    const specifiedDay = argv.day.toLowerCase();
 
    try {
        const sites = readConfig(configFile);

        // Change const to let here
        let auth = await authenticateGoogleSheets();
        const sheets = google.sheets({ version: 'v4', auth: auth });

        for (const site of sites) {

            const siteDay = site.start_date.toLowerCase();
            if (specifiedDay !== 'all' && siteDay !== specifiedDay) {
                console.log(`${site.url} skipped as it is ${today}`);
                continue;
            }

            const separator = '#'.repeat(33); 
            console.log(`
            ${separator}
        
            Starting processing for site: ${site.url}
        
            ${separator}
            `);
            // console.log(`with config: ${JSON.stringify(site)}`);

            const sheetName = await ensureSheetExists(sheets, site.sheet_id, new Date().toISOString().slice(0, 10), 3);

            const unlightOutput = await runUnlighthouse(site.url);
            const csvData = parseCSV('./.unlighthouse/ci-result.csv');
            const headers = Object.keys(csvData[0]);
            const formattedData = [headers, ...csvData.map(row => headers.map(header => row[header] || ''))];

            if (sheetName) {
                // console.log('Auth client initialized for sheets API', auth);
                await uploadToGoogleSheet(auth, site.sheet_id, sheetName, formattedData);
                console.log("Data uploaded successfully, proceeding to insert date.");

                // Refresh or reinitialize auth here
                auth = await authenticateGoogleSheets();
                await insertTodaysDateInSummarySheet(auth, site.sheet_id, site.url);
                console.log(`Date updated in Summary sheet for ${site.url} in Google Sheet: ${sheetName}`);
            } else {
                console.log(`Sheet name is empty for ${site.url}`);
            }
        }
    } catch (error) {
        console.error("An error occurred:", error);
    }
}


main();
