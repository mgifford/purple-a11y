const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');
const yaml = require('js-yaml');
const path = require('path');
const util = require('util');
const { parse } = require('csv-parse');
const exec = util.promisify(require('child_process').exec); 

const TOKEN_PATH = 'token.json';
const CREDENTIALS_PATH = 'credentials.json';
const YAML_CONFIG = 'google-crawl.yml';

// Load client secrets from a local file.
fs.readFile(CREDENTIALS_PATH, (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  authorize(JSON.parse(content), manageSheets);
});


/**
 * Create an OAuth2 client with the given credentials, and then execute the callback function.
 */
function authorize(credentials, callback) {
    const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
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
    const sheets = google.sheets({ version: 'v4', auth });
    let config = loadConfig();
  
    for (const [site, entries] of Object.entries(config)) {
      for (let entry of entries) {
        if (!entry.sheet_id) {
          const response = await sheets.spreadsheets.create({
            resource: { properties: { title: entry.name } },
            fields: 'spreadsheetId',
          });
          const sheetId = response.data.spreadsheetId;
          const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}`;
  
          entry.sheet_id = sheetId;
          entry.sheet_url = sheetUrl;
          console.log(`Created new sheet for ${site}: ${sheetUrl}`);
        }
  
            // Run purple-a11y/cli.js for each URL and wait for it to complete
            const command = `node purple-a11y/cli.js -u ${entry.url} -c 2 -p 5 -k "mike gifford:mike.gifford@civicactions.com"`;
            console.log('Running command:', command);
  

            try {
                await exec(command);
                console.log(`Command completed for URL: ${entry.url}`);

                // Find the most recent directory in the ./results/ directory
                const mostRecentDir = getMostRecentDirectory('./results');
                const reportPath = path.join('./results', mostRecentDir, 'reports', 'report.csv');
                console.log('Uploading report:', reportPath);

                const summary = await analyzeCsvData(reportPath);
                await updateSummarySheet(auth, entry.sheet_id, summary);  

                // Upload CSV report to the Google Sheet
                await uploadToGoogleSheet(auth, entry.sheet_id, reportPath);
            } catch (error) {
                console.error('Error executing command or uploading to sheet:', error);
            }
      }
    }  

    // Save updated config back to YAML after all processing
    saveConfig(config);
  }
  
  function getMostRecentDirectory(basePath) {
    const dirs = fs.readdirSync(basePath, { withFileTypes: true })
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


    async function parseCsv(filePath) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        return new Promise((resolve, reject) => {
          parse(fileContent, {
            columns: false,
            skip_empty_lines: true
          }, (err, output) => {
            if (err) reject(err);
            else resolve(output);
          });
        });
      }

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
  async function uploadToGoogleSheet(auth, spreadsheetId, filePath) {
    const sheets = google.sheets({ version: 'v4', auth });
  
    // Read CSV file content
    const csvContent = fs.readFileSync(filePath, 'utf8');
  
    try {
      // Parse the CSV content
      const records = await new Promise((resolve, reject) => {
        parse(csvContent, {
          columns: false,
          skip_empty_lines: true,
          trim: true,
          relax_column_count: true,
        }, (err, output) => {
          if (err) reject(err);
          else resolve(output);
        });
      });
  
      // Clean data
      const cleanedData = records.map(row => row.map(cleanCell));
  
      // Define the sheet name as today's date in DD-MM-YYYY format
      const today = new Date();
      const sheetName = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;
  
      // Check if a sheet with today's date already exists
      const sheetMetadata = await sheets.spreadsheets.get({
        spreadsheetId: spreadsheetId,
        fields: 'sheets.properties',
      });
  
      let sheetExists = sheetMetadata.data.sheets.some(sheet => sheet.properties.title === sheetName);
  
      // If sheet doesn't exist, create it
      if (!sheetExists) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: spreadsheetId,
          resource: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: sheetName,
                  },
                },
              },
            ],
          },
        });
      }
  
      // Prepare the data for the Google Sheets API
      const resource = {
        values: cleanedData,
      };
  
      // Upload the data to the newly created or existing sheet
      await sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'USER_ENTERED',
        resource,
      });
  
      console.log(`Uploaded data to '${sheetName}' in spreadsheet: ${spreadsheetId}`);
    } catch (err) {
      console.error('Error during CSV parsing or data upload:', err);
    }
  }
  



  async function analyzeCsvData(filePath) {
    console.log(`Starting analysis of CSV data from: ${filePath}`);

    const summary = {
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
        wcagConformance_best_practice: 0,
    };

    let content;
    try {
        content = await fs.promises.readFile(filePath, 'utf8');
    } catch (error) {
        console.error(`Error reading file at ${filePath}:`, error);
        return summary; // Return early with the initial summary structure
    }

    let records;
    try {
        records = await parse(content, { columns: true, skip_empty_lines: true });
    } catch (parseError) {
        console.error(`Error parsing CSV content from ${filePath}:`, parseError);
        return summary; // Return early with whatever was accumulated before the error
    }

    records.forEach((record, index) => {
        try {
            summary.url_count.add(record.url);
            summary.issueId_count.add(record.issueId);
            summary.severity_count.add(record.severity);
            summary.context_count.add(record.context);
            summary.axeImpact_count.add(record.axeImpact);
            summary.xpath_count.add(record.xpath);

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

    // Convert Set sizes to numbers for the final summary
    summary.url_count = summary.url_count.size;
    summary.issueId_count = summary.issueId_count.size;
    summary.severity_count = summary.severity_count.size;
    summary.context_count = summary.context_count.size;
    summary.axeImpact_count = summary.axeImpact_count.size;
    summary.xpath_count = summary.xpath_count.size;

    return summary;
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
  const sheets = google.sheets({ version: 'v4', auth });
  try {
      // Ensure "Summary" sheet exists or create it
      await ensureSheetExists(sheets, spreadsheetId, 'Summary');

      // Append summary data to "Summary" sheet
      const range = 'Summary!A:Z'; // Assuming summary fits within columns A to Z
      await sheets.spreadsheets.values.append({
          spreadsheetId,
          range,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [Object.values(summaryData)] },
      });
      console.log('Summary data updated.');
  } catch (error) {
      console.error('Failed to update summary sheet:', error);
  }
}


async function ensureSheetExists(sheets, spreadsheetId, sheetTitle) {
  const sheetMetadata = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetExists = sheetMetadata.data.sheets.some(sheet => sheet.properties.title === sheetTitle);

  if (!sheetExists) {
      await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          resource: {
              requests: [{ addSheet: { properties: { title: sheetTitle } } }],
          },
      });
  }
}
