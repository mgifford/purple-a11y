// Module Imports
const fs = require("fs");
const readline = require("readline");
const { google } = require("googleapis");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const { exec } = require('child_process');
const fsPromises = require("fs").promises;
const crypto = require("crypto");


const util = require('util');
const execPromise = util.promisify(exec);
const { parse } = require("csv-parse");


// Global Variables
const path = require('path');
const { JSDOM } = require("jsdom");
const baseDir = path.resolve(__dirname);

const RESULTS_DIR = path.join(baseDir, "results");
const TOKEN_PATH = path.join(baseDir, "token.json");
const CREDENTIALS_PATH = path.join(baseDir, "credentials.json");

// Parse command-line arguments
const argv = yargs(hideBin(process.argv)).options({
  type: { type: 'string', demandOption: true, default: 'crawl'},
  name: { type: 'string', demandOption: true },
  url: { type: 'string', demandOption: true },
  max: { type: 'number', demandOption: true, default: 100},
  sheet_id: { type: 'string', demandOption: true },
  exclude: { type: 'string', demandOption: true, default: ''},
  strategy: { type: 'string', demandOption: true, default: 'same-hostname'},
}).argv; 

async function main() {
  // Authenticate with Google Sheets API
  const auth = await authenticateGoogleSheets(CREDENTIALS_PATH);

  // Use the command-line arguments directly
  const siteType = argv.type;
  const siteName = argv.name;
  const siteUrl = argv.url;
  const maxPages = argv.max;
  const sheetId = argv.sheet_id;   
  const exclude = argv.exclude;
  const strategy = argv.strategy;

  console.log(`\n\n\n ++++====++++ \n\nStarting Scan for ${siteName}`);
  console.log(`Processing ${siteType} for URL: ${siteUrl} with max pages: ${maxPages}`);
  logMemoryUsage();

  // Define the command to run your scan based on the site type and other parameters
  // Removed as I don't think these are working in purple-a11y:  -a none ${exclude ? `--blacklistedPatternsFilename ${exclude}` : ''} 

  let typeOption = `-c 2 -s ${strategy}`;
  if (siteType === 'sitemap') {
    typeOption = " -c 1";
  } 
  const command = `node --max-old-space-size=6000 --no-deprecation purple-a11y/cli.js -u ${siteUrl} ${typeOption} -p ${maxPages} -k "CivicActions gTracker:accessibility@civicactions.com"`;

      const startTime = new Date();

      let reportPath = ""; // Reset path for each site

      // Ensure each site entry has a dedicated Google Sheet
      if (!sheetId) {
        const responseSpreadsheet = await sheets.spreadsheets.create({
          resource: {
            properties: {
              title: entry.name,
            },
          },
          fields: "spreadsheetId",
        });
        const sheetId = responseSpreadsheet.data.spreadsheetId;

        let responseURL = await fetch(siteUrl);
        if (!responseURL) {
          console.error(`Failed to load URL: ${siteUrl}`);
          return false;
        }
      }

      // Await the completion of the command, including handling retries
      try {
        console.log(`Command: ${command}`);
        const output = await runCommandWithTimeout(command);
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (error) {
        console.error("Command failed after all retries:", error);
        return false;
      }

      insertTodaysDateInSummarySheet(auth, sheetId, siteUrl); // Insert today's date in the Summary sheet

      // Process the results and update the Google Sheet
      try {

        const reportPath = path.join(RESULTS_DIR, getMostRecentDirectory(siteUrl), "reports", "report.csv");

        waitForFile(reportPath);
        fs.exists(reportPath, (exists) => {
          console.log(`${reportPath} ${exists ? 'exists' : 'does not exist'}`);
        });

        // Optionally, call prepareDataForUpload if you need to process CSV data
        let processedRecords = await prepareDataForUpload(reportPath);
        const endTime = new Date();
        const scanDuration = formatDuration((endTime - startTime) / 1000); // Duration in seconds
        console.log(`\n\nScan Duration: (${scanDuration})\n`);

        // Upload the processed CSV report to the Google Sheet
        await uploadToGoogleSheet(
          auth,
          sheetId,
          processedRecords,
          scanDuration,
        );
        await new Promise(resolve => setTimeout(resolve, 60000));

        
        console.log(`Data uploaded to Google Sheet URL: https://docs.google.com/spreadsheets/d/${sheetId}`);
        logMemoryUsage();

        // Clear processed records to free up memory
        processedRecords = null;
      } catch (error) {
        console.error(
          "Error processing and uploading data for URL:",
          siteUrl,
          error,
        );
      }
  
}

async function authenticateGoogleSheets(credentialsPath) {
  // console.log("Authenticated with Google Sheets API");
  // Load client secrets from a local file.
  const content = await fs.promises.readFile(credentialsPath, 'utf8');
  const credentials = JSON.parse(content);
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  let token;
  try {
    token = await fs.promises.readFile(TOKEN_PATH, 'utf8');
  } catch (error) {
    return getNewToken(oAuth2Client);
  }
  
  oAuth2Client.setCredentials(JSON.parse(token));
  return oAuth2Client;
}

function getNewToken(oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  console.log('Authorize this app by visiting this URL:', authUrl);
  // Further implementation needed to handle the new token
  // Typically involves a web server to receive the response
}


// Call the main function to start the script
// main().catch(console.error);


/**
 * Runs a command with a specified timeout and retry logic.
 * @param {string} command The command to run.
 * @param {number} maxAttempts Maximum number of attempts to run the command.
 * @param {number} retryDelay Delay between retries in milliseconds.
 * @param {number} totalTimeout Total timeout for each command execution in milliseconds.
 */
async function runCommandWithTimeout(command, maxAttempts = 3, retryDelay = 30000, totalTimeout = 720000) {
  // console.log(`runCommandWithTimeout: Attempting to run command: ${command}`);

  let attempt = 0;
  const env = { ...process.env }; // Duplicate current environment variables

  while (attempt < maxAttempts) {
    attempt++;
    try {
      console.log(`Attempt ${attempt}: Executing command: ${command}`);
      logMemoryUsage();

      // Enhanced logging including the shell used
      console.log(`Running command: ${command}`);
      // console.log(`Using shell: ${process.env.SHELL || 'default shell'}`);

      const { stdout, stderr } = await execPromise(command, {
        timeout: totalTimeout,
        shell: '/bin/zsh', // Specify the shell if necessary
        env: process.env, // env, // Pass environment variables
        encoding: 'utf8', 
        maxBuffer: 1024 * 1024, // Increase maxBuffer size if necessary
      });
      console.log('Command success, output:', stdout);

      return true;

    } catch (error) {
      console.error(`runCommandWithTimeout: Attempt ${attempt} failed: ${error.message}`);

      console.log('Command failed, error:', error);

      if (attempt < maxAttempts) {
        console.log(`Waiting ${retryDelay / 1000} seconds before retrying...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        throw new Error(`Command failed after ${maxAttempts} attempts: ${command}`);
      }
    }
  }
}

async function clearSheetContents(sheets, spreadsheetId, sheetName) {
  try {
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${sheetName}!A1:Z`,
    });
    console.log(`Cleared contents of sheet "${sheetName}".`);
  } catch (err) {
    console.error(`Error clearing sheet contents: ${err}`);
    throw err; // Rethrow to handle in retry logic
  }
}

async function appendDataToSheet(sheets, spreadsheetId, sheetName, data) {
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: "USER_ENTERED",
      resource: { values: data },
    });
    console.log(`Data appended to sheet "${sheetName}" successfully.`);
  } catch (err) {
    console.error(`Error appending data to sheet: ${err}`);
    throw err; // Rethrow to handle in retry logic
  }
}

async function ensureSheetExists(sheets, spreadsheetId, sheetName) {
  try {
    const sheetMetadata = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets(properties.title)",
    });
    const sheetTitles = sheetMetadata.data.sheets.map(sheet => sheet.properties.title);

    if (!sheetTitles.includes(sheetName)) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: {
          requests: [{
            addSheet: { properties: { title: sheetName } }
          }],
        },
      });
      console.log(`Sheet "${sheetName}" created.`);
    }
  } catch (err) {
    console.error(`Error ensuring sheet exists: ${err}`);
    throw err; // Rethrow to handle in retry logic
  }
}

async function uploadToGoogleSheet(auth, spreadsheetId, processedRecords, scanDuration) {
  const sheets = google.sheets({version: "v4", auth});
  const today = new Date();
  const sheetName = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, "0")}-${today.getDate().toString().padStart(2, "0")}`;

  try {
    // Ensure the sheet exists, retry on failure
    await ensureSheetExists(sheets, spreadsheetId, sheetName);
    // Check if clearing is needed then clear contents, retry on failure
    await clearSheetContents(sheets, spreadsheetId, sheetName);
    // Append data to the sheet, retry on failure
    await appendDataToSheet(sheets, spreadsheetId, sheetName, [
      // Header row
      ["URL", "axe Impact", "Severity", "Issue ID", "WCAG Conformance", "Context", "HTML Fingerprint", "XPath", "Hash Context", "Hash xPath"],
      ...processedRecords.map(record => [
        record.url,
        record.axeImpact,
        record.severity,
        record.issueId,
        record.wcagConformance,
        record.context,
        record.htmlFingerprint,
        record.xpath,
        record.md5Hashcontext,
        record.md5Hashxpath,
      ])
    ]);
  } catch (err) {
    console.error("Failed to upload data to Google Sheet:", err);
    throw err; // Consider how to handle this failure externally
  }
}







/*
async function uploadToGoogleSheet(auth, spreadsheetId, processedRecords, scanDuration) {
  console.log("uploadToGoogleSheet: Starting upload to Google Sheet");
  const sheets = google.sheets({version: "v4", auth});
  try {
    // Define your headers here -- MAKE THIS ORDER MAKE SENSE
    const headers = [
      "URL",
      "axe Impact",
      "Severity",
      "Issue ID",
      "WCAG Conformance",
      "Context",
      "HTML Fingerprint",
      "XPath",
      "Hash Context",
      "Hash xPath",
    ];

    const values = processedRecords.map((record) => [
      record.url,
      record.axeImpact,
      record.severity,
      record.issueId,
      record.wcagConformance,
      record.context,
      record.htmlFingerprint,
      record.xpath,
      record.md5Hashcontext,
      record.md5Hashxpath,
    ]);

    // Prepend headers to the values array
    values.unshift(headers);

    // Construct the sheet name based on today's date
    const today = new Date();
    const sheetName = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, "0")}-${today.getDate().toString().padStart(2, "0")}`;

    // Check if the sheet exists, and if not, create it
    const sheetMetadata = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets(properties.title)",
    });

    const existingSheetTitles = sheetMetadata.data.sheets.map(
      (sheet) => sheet.properties.title,
    );
    if (existingSheetTitles.includes(sheetName)) {
      // Clear the existing sheet contents
      await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${sheetName}!A1:Z`,
      });
    }
    const sheetTitles = sheetMetadata.data.sheets.map(
      (sheet) => sheet.properties.title,
    );

    if (!sheetTitles.includes(sheetName)) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
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

    // Append the data to the sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: "USER_ENTERED",
      resource: {
        values,
      },
    });
    console.log(`Uploaded data to '${sheetName}' in spreadsheet: ${spreadsheetId}`);
    logMemoryUsage();
  } catch (err) {
    console.error("uploadToGoogleSheet: Error uploading data to Google Sheets:", err);
  }

  processedRecords = null; // Clear the processed records to free up memory
}

*/

// Authentication

/**
 * Create an OAuth2 client with the given credentials, and then execute the callback function.
 */
function authorize(credentials, callback) {
  const { client_secret, client_id, redirect_uris } =
    credentials.installed || credentials.web;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0],
  );

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
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  console.log("Authorize this app by visiting this URL:", authUrl);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question("Enter the code from that page here: ", (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error("Error retrieving access token", err);
      oAuth2Client.setCredentials(token);
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log("Token stored to", TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

// File Operations / Authentication

// Load client secrets from a local file.
fs.readFile(CREDENTIALS_PATH, (err, content) => {
  if (err) return console.log("Error loading client secret file:", err);
  authorize(JSON.parse(content), main);
});


function getMostRecentDirectory(site) {
  const dirs = fs
    .readdirSync(RESULTS_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => ({
      name: dirent.name,
      time: fs.statSync(path.join(RESULTS_DIR, dirent.name)).mtime.getTime(),
    }))
    .sort((a, b) => b.time - a.time);

  if (dirs.length > 0) {
    console.log(`Most recent directory for site ${site}: ${dirs[0].name}`);
    return dirs[0].name;
  } else {
    throw new Error("No directories found in basePath");
  }
}

/*
function saveConfig(config) {
  try {
    fs.writeFileSync(YAML_CONFIG, yaml.dump(config), "utf8");
    console.log("Updated YAML configuration saved.");
  } catch (e) {
    console.error("Failed to save the updated configuration:", e);
  }
}
*/

// Utility Functions

function generateMD5Hash(input) {
  const hash = crypto.createHash("md5").update(input).digest("hex");
  // Convert the first 8 characters (which represent 32 bits) to a decimal number
  const numericalHash = parseInt(hash.substring(0, 8), 16);
  return numericalHash;
}

function formatDuration(durationInSeconds) {
  const hours = Math.floor(durationInSeconds / 3600);
  const minutes = Math.floor((durationInSeconds % 3600) / 60);
  const seconds = Math.round(durationInSeconds % 60); // Use round to get to the nearest second

  let result = [];

  if (hours > 0) {
    result.push(`${hours}h`);
  }
  if (minutes > 0) {
    result.push(`${minutes}m`);
  }
  if (seconds > 0 || result.length === 0) {
    // Always show seconds if there are no hours or minutes,
    // or if seconds is non-zero
    result.push(`${seconds}s`);
  }

  return result.join(" ");
}

// Helper function to parse CSV data asynchronously
async function parseCSV(data) {
  return new Promise((resolve, reject) => {
    parse(
      data,
      {
        columns: true,
        skip_empty_lines: true,
      },
      (err, output) => {
        if (err) {
          reject(err);
        } else {
          resolve(output);
        }
      },
    );
  });
}

/**
 * Cleans a cell by removing unnecessary quotes and trimming spaces.
 *
 * @param {string} cell The cell content to clean.
 * @returns {string} The cleaned cell content.
 */
function cleanCell(cell) {
  let cleanedCell = cell.replace(/^"|"$/g, "").trim(); // Remove surrounding quotes
  cleanedCell = cleanedCell.replace(/""/g, '"'); // Replace double quotes with single
  return cleanedCell;
}

function sanitizeHtml(html) {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  // Remove unwanted attributes and text nodes
  function cleanse(node) {
    node.querySelectorAll("*").forEach((el) => {
      el.removeAttribute("title");
      el.removeAttribute("href");
      // If you need to remove any other attributes, do it here.
      if (el.hasChildNodes()) {
        el.childNodes.forEach((child) => {
          if (child.nodeType === dom.window.Node.TEXT_NODE) {
            // Replace nbsp and other HTML entities
            const textContent = child.textContent
              .replace(/&nbsp;|[\u00A0]/g, "")
              .trim();
            if (textContent === "") {
              child.remove();
            } else {
              child.textContent = " ";
            }
          } else if (child.nodeType === dom.window.Node.ELEMENT_NODE) {
            cleanse(child);
          }
        });
      }
    });
  }

  cleanse(document.body);

  return document.body.innerHTML;
}

function formatWcagCriteria(criteria) {
  // Check if the value contains the string "wcag"
  if (!criteria.startsWith("wcag")) {
    // If it doesn't contain "wcag", return the original value
    return criteria;
  }

  // Remove the "wcag" prefix and capture the numeric part
  const numericPart = criteria.replace(/^wcag/, "");

  // Insert dots after the 1st and 2nd digits to format it correctly
  const formatted = numericPart.replace(/^(.)(.)/, "$1.$2.");

  return formatted;
}


// Do what is needed to prepare the data for upload, limit results to 8000 by default
async function prepareDataForUpload(filePath, count = 8000) {
  try {
    const fileContent = await fsPromises.readFile(filePath, "utf8");
    const records = await parseCSV(fileContent);
    
    // Filter and prioritize the records
    const mustFix = records.filter(record => record.severity === 'mustFix');
    const goodToFix = records.filter(record => record.severity === 'goodToFix');
    const needsReview = records.filter(record => record.severity === 'needsReview');
    
    const prioritizedRecords = [...mustFix, ...goodToFix, ...needsReview];
    
    return prioritizedRecords.slice(0, count).map(record => ({
      url: record.url,
      axeImpact: record.axeImpact,
      severity: record.severity,
      issueId: record.issueId,
      wcagConformance: formatWcagCriteria(record.wcagConformance),
      context: record.context,
      htmlFingerprint: sanitizeHtml(record.context),
      xpath: record.xpath,
      md5Hashcontext: generateMD5Hash(`${record.url}${record.context}`),
      md5Hashxpath: generateMD5Hash(`${record.url}${record.xpath}`),
    }));
  } catch (error) {
    console.error("Error preparing data for upload:", error);
    throw error;
  }
}

// Inserts today's date into the last cell of the "Summary" sheet
async function insertTodaysDateInSummarySheet(auth, spreadsheetId, url) {
  console.log(`insertTodaysDateInSummarySheet: Inserting today's date for URL: ${url}`);

  const sheets = google.sheets({version: "v4", auth});

  try {
    // First, ensure that the "Summary" sheet exists
    await ensureSheetExists(sheets, spreadsheetId, "Summary");

    // Then, attempt to fetch the range to check if today's date already exists
    const range = "Summary!A:A";
    const result = await sheets.spreadsheets.values.get({spreadsheetId, range});

    // Format today's date as YYYY-MM-DD
    const today = new Date();
    const formattedDate = today.toISOString().split("T")[0];

    // Check if formattedDate already exists in column A
    const existingDates = result.data.values ? result.data.values.flat() : [];
    if (existingDates.includes(formattedDate)) {
      console.log(`Today's date (${formattedDate}) already exists in the Summary sheet for ${url}.`);
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

    console.log(`Inserted today's date (${formattedDate}) into the first empty row of the Summary sheet for ${url}.`);
    logMemoryUsage();
  } catch (err) {
    console.error("insertTodaysDateInSummarySheet: Error inserting today's date into the Summary sheet:", err);
  }
}

// This function checks if a specific sheet exists, and creates it if not
async function ensureSheetExists(sheets, spreadsheetId, sheetTitle) {
  try {
    const sheetMetadata = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets(properties/title)',
    });

    const sheetExists = sheetMetadata.data.sheets.some(sheet => sheet.properties.title === sheetTitle);

    if (!sheetExists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: {
          requests: [{
            addSheet: {
              properties: { title: sheetTitle },
            },
          }],
        },
      });
      console.log(`"${sheetTitle}" sheet did not exist and was created.`);
    }
  } catch (error) {
    console.error(`Error ensuring "${sheetTitle}" sheet exists:`, error);
    throw error; // Rethrow to handle it in the calling function
  }
}

// Debugging memory usage
function logMemoryUsage() {
  const used = process.memoryUsage().heapUsed / 1024 / 1024;
  console.log(
    `The script uses about ${Math.round(used)} MB`,
  );
}

// Utility function to wait for a file to exist before proceeding
function waitForFile(filePath, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const checkFile = () => {
      fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
          setTimeout(checkFile, timeout);
        } else {
          resolve();
        }
      });
    };
    checkFile();
  });
}
