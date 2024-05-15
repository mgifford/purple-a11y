// Module Imports
const fs = require("fs");
const readline = require("readline");
const { google } = require("googleapis");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");

const fsPromises = require("fs").promises;
const crypto = require("crypto");

const util = require('util');
// const execPromise = util.promisify(exec);
const { parse } = require("csv-parse");


// Global Variables
const path = require('path');
const { JSDOM } = require("jsdom");
// const { exec } = require('child_process');
const { spawn } = require('child_process');
const baseDir = path.resolve(__dirname);
const lockFilePath = path.join(__dirname, 'scan.lock');

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

removeLock(); // Ensure the lock is removed before starting

async function main() {
  if (await isLocked()) {
    console.log('A scan is already in progress. Exiting...');
    return;
  }
  await setLock();

  // Authenticate with Google Sheets API
  const auth = await authenticateGoogleSheets(CREDENTIALS_PATH);

  // Use the command-line arguments directly
  const siteType = argv.type;
  const siteName = argv.name;
  const siteUrl = argv.url;
  const maxPages = argv.max;
  const spreadsheetId = argv.sheet_id;   
  const exclude = argv.exclude;
  const strategy = argv.strategy;

  console.log(`\n\n\n ++++====++++ \n\nStarting Scan for ${siteName}`);
  console.log(`Processing ${siteType} for URL: ${siteUrl} with max pages: ${maxPages}`);
  logMemoryUsage();

  // Define the command to run your scan based on the site type and other parameters
  // Removed as I don't think these are working in purple-a11y:  -a none ${exclude ? `--blacklistedPatternsFilename ${exclude}` : ''} 

  let typeOption = `-c ${siteType === 'sitemap' ? '1' : '2'} -s ${strategy}`;
  const command = `node --max-old-space-size=6000 --no-deprecation purple-a11y/cli.js -u ${siteUrl} ${typeOption} -p ${maxPages} -k "CivicActions gTracker:accessibility@civicactions.com"`;

      const startTime = new Date();

      // Ensure each site entry has a dedicated Google Sheet
      if (!spreadsheetId) {
        const responseSpreadsheet = await sheets.spreadsheets.create({
          resource: {
            properties: {
              title: entry.name,
            },
          },
          fields: "spreadsheetId",
        });
        const newSheetId = responseSpreadsheet.data.spreadsheetId;
        
        let responseURL = await fetch(siteUrl);
        if (!responseURL) {
          console.error(`Failed to load URL: ${siteUrl}`);
          return false;
        }
      }

      // Await the completion of the command, including handling retries
      try {
        // console.log(`Command: ${command}`);
        const output = await runCommandWithTimeout(command, maxPages, 1, 30000, 3600000, siteUrl)
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (error) {
        console.error("Command failed after all retries:", error);
        return false;
      }

    // Assuming `getMostRecentDirectory` is meant to check within the results directory
      try {
        const mostRecentDir = getMostRecentDirectory(RESULTS_DIR);
        const reportPath = path.join(RESULTS_DIR, mostRecentDir, "reports", "report.csv");

        waitForFile(reportPath);
        fs.exists(reportPath, async (exists) => {
          if (exists) {
            console.log(`${reportPath} exists (main), preparing data for upload.`);
            // Replace the existing CSV processing call with the new function
            await parseAndUploadResults(reportPath, auth, spreadsheetId, startTime);
          } else {
            console.log(`${reportPath} does not exist.`);
          }
        });

        // Optionally, call prepareDataForUpload if you need to process CSV data
        console.log(`Preparing data for upload from: ${reportPath}`);
        let processedRecords = await prepareDataForUpload(reportPath);

        const endTime = new Date();
        const scanDuration = formatDuration((endTime - startTime) / 1000); // Duration in seconds
        console.log(`\n\nScan Duration: (${scanDuration})\n`);

        // Upload the processed CSV report to the Google Sheet
        await uploadToGoogleSheet(auth, spreadsheetId, processedRecords, scanDuration);
        insertTodaysDateInSummarySheet(auth, spreadsheetId, siteUrl); // Insert today's date in the Summary sheet

        await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 60 seconds before continuing
        
        console.log(`Data uploaded to Google Sheet URL: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
        processedRecords = null; // Clear processed records to free up memory

      } catch (error) {
        console.error(
          "Error processing and uploading data for URL:",
          siteUrl,
          error,
        );
      } finally {
        console.log(`Scan for ${siteName} completed.`);
        await removeLock();  // Ensure lock is removed before exiting
        process.exit(0); // Successfully exit
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

  // Handle errors
  try {
    // Code that may throw an error
  } catch (error) {
    console.error('Error:', error);
    // Handle the error appropriately
  }
}


/**
 * Runs a command with a specified timeout and retry logic.
 * @param {string} command The command to run.
 * @param {number} maxAttempts Maximum number of attempts to run the command.
 * @param {number} retryDelay Delay between retries in milliseconds.
 * @param {number} totalTimeout Total timeout for each command execution in milliseconds.
 */
async function runCommandWithTimeout(command, maxPages, maxAttempts, retryDelay, totalTimeout, siteUrl) {
  let currentPageCount = 0;
  let attempt = 0;
  const parts = command.split(' ');
  const cmd = parts[0];
  const args = parts.slice(1);

  // console.log(`Preparing to execute: ${cmd} with args ${args.join(' ')}`);

  while (attempt < maxAttempts) {
      attempt++;
      console.log(`Attempt ${attempt}: Executing command: ${cmd} ${args.join(' ')}`);
      try {
          const { stdout, stderr } = await executeCommand(cmd, args, totalTimeout);
          console.log(`Command stdout: ${stdout}`);
          if (stderr) console.error(`Command stderr: ${stderr}`);

          // Here you would call a function to process `stdout` to count pages or handle the output
          // e.g., currentPageCount = processStdOut(stdout, currentPageCount);

          if (currentPageCount >= maxPages) {
              console.log(`Reached the page limit of ${maxPages}, stopping.`);
              break;
          }
      } catch (error) {
        console.error(`Attempt ${attempt} failed with error: ${error.message}`);
        if (attempt >= maxAttempts) {
          console.error("All attempts failed, exiting.");
          throw error;
        }
      } finally {
        console.log(`Removing lock after attempt ${attempt}`);
        await removeLock(); // Ensure lock is always removed
      }
      await new Promise(resolve => setTimeout(resolve, retryDelay));
  }
}

async function executeCommand(cmd, args, totalTimeout) {
  return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, { shell: true });
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', data => {
          stdout += data.toString();
          console.log('', data.toString()); // Log output immediately for debugging
      });

      child.stderr.on('data', data => {
          stderr += data.toString();
          console.log('STDERR:', data.toString()); // Log errors immediately for debugging
      });

      child.on('close', code => {
          if (code === 0) {
              resolve({ stdout, stderr });
          } else {
              reject(new Error(`Command failed with exit code ${code}: ${stderr}`));
          }
      });

      // Timeout to kill the process if it runs too long
      setTimeout(() => {
          child.kill('SIGTERM'); // Ensure to terminate the process
          reject(new Error(`Command timeout after ${totalTimeout} ms: ${stderr}`)); // Include stderr even in timeout
      }, totalTimeout);
  });
}


// Example output processor that can decide to resolve early
function outputProcessor(output, resolve) {
  if (output.includes('Scan Summary')) {
      console.log("Scan Summary Detected, finishing early");
      resolve(); // Resolve the command execution early based on specific output
  }
  // Additional checks like page count could be integrated here
}


// Function to parse CSV and upload results in chunks
async function parseAndUploadResults(filePath, auth, spreadsheetId, startTime) {
  try {
      // Read the CSV file and parse it
      console.log(`parseAndUploadResults -  Parsing CSV file: ${filePath}`);
      const chunkSize = 500; // Define the chunk size for uploading
      const fileContent = await fsPromises.readFile(filePath, 'utf8'); 
      const records = await parseCSV(filePath); // Ensure this returns the parsed data
      const today = new Date();
      const sheetName = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, "0")}-${today.getDate().toString().padStart(2, "0")}`;
    
      if (records.length > 10) {
        const sheets = google.sheets({version: "v4", auth});
        // Ensure the sheet exists, retry on failure
        await ensureSheetExists(sheets, spreadsheetId, sheetName, 4);
        // Check if clearing is needed then clear contents, retry on failure
        await clearSheetContents(sheets, spreadsheetId, sheetName);
      }

      for (let i = 0; i < records.length; i += chunkSize) {
          console.log(`Uploading chunk ${i / chunkSize + 1} of ${Math.ceil(records.length / chunkSize)} - ${records.length}`);
          const chunk = records.slice(i, i + chunkSize);

          // Upload each chunk to Google Sheets
          await uploadToGoogleSheet(auth, spreadsheetId, chunk, formatDuration(new Date() - startTime));
          console.log(`Uploaded chunk ${i / chunkSize + 1} to Google Sheets`);
      }
  } catch (error) {
      console.error('Failed to parse and upload CSV:', error);
  }
}


function chunk(array, size) {
  return Array.from({ length: Math.ceil(array.length / size) }, (v, i) =>
      array.slice(i * size, i * size + size)
  );
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

// Look for the sheet and create it if it doesn't exist.
async function ensureSheetExists(sheets, spreadsheetId, sheetName, index) {
    try {
        const sheetMetadata = await sheets.spreadsheets.get({
            spreadsheetId,
            fields: 'sheets(properties(title, index))'
        });

        const exists = sheetMetadata.data.sheets.some(sheet => sheet.properties.title === sheetTitle);

        if (!exists) {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                resource: {
                    requests: [{
                        addSheet: {
                            properties: {
                                title: sheetTitle,
                                index: index // Set index where new sheet should be inserted
                            }
                        }
                    }]
                }
            });
            console.log(`"${sheetTitle}" sheet created at position ${index + 1}.`);
        } else {
            console.log(`Sheet "${sheetTitle}" already exists.`);
        }
    } catch (error) {
        console.error(`Error ensuring sheet exists: ${error}`);
        throw error;
    }
}


async function uploadToGoogleSheet(auth, spreadsheetId, processedRecords, scanDuration) {
  const sheets = google.sheets({ version: "v4", auth });
  const today = new Date();
  const sheetName = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, "0")}-${today.getDate().toString().padStart(2, "0")}`;

  try {
    const range = `${sheetName}!A1`;

    // Log the range to verify its format
    console.log(`Uploading data to range: ${range}`);

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

async function appendDataToSheet(sheets, spreadsheetId, sheetName, data) {
  let range;
  try {
    // Correctly format the sheet name to handle date-like names
    range = `${sheetName}!A1`;

    // Log the range and data length for debugging
    console.log(`Appending data to range: ${range}`);
    console.log(`Data length: ${data.length}`);

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: range,
      valueInputOption: "USER_ENTERED",
      resource: { values: data },
    });
    console.log(`Data appended to sheet "${sheetName}" successfully.`);
  } catch (err) {
    console.error(`Error appending data to sheet ${range}: ${err.message}`);
    console.error(`Stack trace: ${err.stack}`);
    if (range) {
      console.error(`The range was defined as: ${range}`);
    } else {
      console.error(`The range variable was not defined.`);
    }
    console.error(`Spreadsheet ID: ${spreadsheetId}`);
    console.error(`Sheet Name: ${sheetName}`);
    console.error(`Data: ${JSON.stringify(data)}`);
    throw err; // Rethrow to handle in retry logic
  }
}



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
  // console.log("Reading token from:", TOKEN_PATH);
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

      console.log("Token stored to", TOKEN_PATH);
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

function getMostRecentDirectory(basePath, timeWindow = 300000) { // 5 minutes window by default
  const currentTime = Date.now(); // Get the current time inside the function
  const directories = fs.readdirSync(basePath, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => {
        const dirPath = path.join(basePath, dirent.name);
        const stat = fs.statSync(dirPath);
        return { name: dirent.name, time: stat.mtime.getTime() };
    })
    .filter(dir => currentTime - dir.time < timeWindow) // Filter out directories older than the time window
    .sort((a, b) => b.time - a.time); // Sort directories by modified time in descending order

  if (directories.length > 0) {
    console.log(`Most recent directory within time window: ${directories[0].name}`);
    return directories[0].name;
  } else {
    throw new Error("No recent directories found in the specified path.");
  }
}



const renameAndPrepareHtmlFiles = async (baseDir, siteUrl) => {
  const currentDate = new Date().toISOString().split('T')[0]; // Format as YYYY-MM-DD
  const domain = new URL(siteUrl).hostname;
  const sourceDir = path.join(baseDir, getMostRecentDirectory(siteUrl), 'reports');

  const htmlFiles = ['report.html', 'summary.html'];

  try {
    for (let fileName of htmlFiles) {
      const oldPath = path.join(sourceDir, fileName);
      const newName = `${domain}_${currentDate}_${fileName}`;
      const newPath = path.join(sourceDir, newName);
      await fsPromises.rename(oldPath, newPath);
      console.log(`Renamed ${fileName} to ${newName}`);
    }
  } catch (error) {
    console.error('Failed to rename HTML files:', error);
    throw error;
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
function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(parse({
        columns: true,
        delimiter: ',',
        trim: true,
        skip_empty_lines: true
      }))
      .on('error', error => reject(error))
      .on('data', row => results.push(row))
      .on('end', () => resolve(results));  // Resolve with all records
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
  if (!html) {
      console.error("sanitizeHtml received empty or invalid HTML");
      return ""; // Return empty string for invalid input
  }

  const dom = new JSDOM(html);
  const document = dom.window.document;

  // Only remove specific unwanted attributes and preserve more structure
  function cleanse(node) {
      node.querySelectorAll("*").forEach((el) => {
          // Remove only specific attributes known to be unnecessary
          ['style', 'onclick', 'onmouseover'].forEach(attr => el.removeAttribute(attr));

          // Optionally remove elements by tag name if necessary, e.g., <script>, <style>
          if (el.tagName.toLowerCase() === 'script' || el.tagName.toLowerCase() === 'style') {
              el.remove();
          }

          if (el.hasChildNodes()) {
              el.childNodes.forEach((child) => {
                  if (child.nodeType === dom.window.Node.TEXT_NODE) {
                      // Simplify text handling: only trim and replace known problematic entities
                      const textContent = child.textContent.replace(/&nbsp;|[\u00A0]/g, " ").trim();
                      child.textContent = textContent;
                  } else if (child.nodeType === dom.window.Node.ELEMENT_NODE) {
                      cleanse(child);
                  }
              });
          }
      });
  }

  cleanse(document.body);

  // Return the sanitized inner HTML of the body
  return document.body.innerHTML.trim(); // Ensure it's trimmed to avoid returning only whitespace
}



function generateMD5Hash(input) {
  if (!input) {
      console.error("generateMD5Hash received empty or invalid input");
      return ""; // Return empty string for invalid input
  }

  const hash = crypto.createHash("md5").update(input).digest("hex");
  // Convert the first 8 characters (which represent 32 bits) to a decimal number
  const numericalHash = parseInt(hash.substring(0, 8), 16);
  process.stdout.write('*'); // Log a character for each hash generated
  return numericalHash;
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


async function prepareDataForUpload(filePath, count = 10000) {
  try {
      console.log(`prepareDataForUpload - Preparing data for upload from: ${filePath}`);
      const fileContent = await fsPromises.readFile(filePath, "utf8"); // Read file content
      const records = await parseCSV(filePath); // Ensure parseCSV actually returns records

      // Check if records is not undefined and is an array
      if (!Array.isArray(records) || records.length === 0) {
          console.error("No records found or records are not in expected format");
          return [];
      }

      const mustFix = records.filter(record => record.severity === 'mustFix');
      const goodToFix = records.filter(record => record.severity === 'goodToFix');
      const needsReview = records.filter(record => record.severity === 'needsReview');

      const prioritizedRecords = [...mustFix, ...goodToFix, ...needsReview];

      return prioritizedRecords.slice(0, count).map(record => {
          const context = record.context;
          const sanitizedHtml = sanitizeHtml(context);
          const md5HashContext = generateMD5Hash(`${record.url}${context}`);
          const md5HashXpath = generateMD5Hash(`${record.url}${record.xpath}`);

          // Logging the values for debugging
          // console.log(`Processing record: URL=${record.url}, context=${context}`);
          if (!sanitizedHtml) {
              console.log(`Empty sanitized HTML: ${context}`);
              console.error("Empty context found for record:", record);
          }
          if (!md5HashContext) {
              console.log(`Empty MD5 Hash: ${record.url} ${context}`);
               // console.log(`MD5 Hash Xpath: ${md5HashXpath}`);
              console.error("Empty MD5 hash for context:", context);
          }

          return {
              url: record.url,
              axeImpact: record.axeImpact,
              severity: record.severity,
              issueId: record.issueId,
              wcagConformance: formatWcagCriteria(record.wcagConformance),
              context: context,
              htmlFingerprint: sanitizedHtml,
              xpath: record.xpath,
              md5Hashcontext: md5HashContext,
              md5Hashxpath: md5HashXpath,
          };
      });
  } catch (error) {
    const logFilePath = logError(domain, err);
    console.error(`Failed to upload data to Google Sheet. See full results in ${logFilePath}`);
    throw err; // Consider how to handle this failure externally
  }
}



// This function checks if a specific sheet exists, and creates it if not 
// It is a near duplicate of the ensureSheetExists function which occurs inside another function
async function ensureSheetExists(sheets, spreadsheetId, sheetTitle, index) {
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
                properties: {
                    title: sheetTitle,
                    index: index // Ensure this is a valid index
                }
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


function setLock() {
  return new Promise((resolve, reject) => {
    fs.open(lockFilePath, 'wx', (err, fd) => {
      if (err) {
        if (err.code === 'EEXIST') return reject(new Error('Lock file already exists'));
        return reject(err);
      }
      fs.close(fd, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  });
}

function removeLock() {
  return fs.promises.access(lockFilePath, fs.constants.F_OK)
    .then(() => {
      return fs.promises.unlink(lockFilePath);
    })
    .catch(err => {
      if (err.code === 'ENOENT') {
        // If no such file, it's already removed, so resolve normally
        console.log('No lock file to remove.');
        return;
      } else {
        console.error('Unexpected error accessing lock file:', err);
        throw err;
        return;
      }
    });
}


function isLocked() {
  return fs.promises.access(lockFilePath, fs.constants.F_OK)
    .then(() => true)
    .catch(err => {
      if (err.code === 'ENOENT') return false;
      throw err;
    });
}



// Inserts today's date into the last cell of the "Summary" sheet
async function insertTodaysDateInSummarySheet(auth, spreadsheetId, url) {
  console.log(`insertTodaysDateInSummarySheet: Inserting today's date for URL: ${url}`);

  const sheets = google.sheets({version: "v4", auth});

  try {
    // First, ensure that the "Summary" sheet exists
    await ensureSheetExists(sheets, spreadsheetId, "Summary", 1);

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
  console.log(`Waiting for file: ${filePath}`);
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

function logError(domain, error) {
  const logsDir = path.join(__dirname, "logs");
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
  }
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, "0")}-${today.getDate().toString().padStart(2, "0")}`;
  const timeStr = `${today.getHours().toString().padStart(2, "0")}-${today.getMinutes().toString().padStart(2, "0")}-${today.getSeconds().toString().padStart(2, "0")}`;
  const logFileName = `${domain}-${dateStr}-${timeStr}-error.log`;
  const logFilePath = path.join(logsDir, logFileName);
  
  const errorDetails = `Error: ${error.message}\nStack: ${error.stack}\n\n`;
  fs.appendFileSync(logFilePath, errorDetails);

  return logFilePath;
}
