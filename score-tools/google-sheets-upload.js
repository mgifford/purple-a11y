// Module Imports

const fs = require("fs");
const fsPromises = require("fs").promises;
const readline = require("readline");
const { google } = require("googleapis");
const yaml = require("js-yaml");
const path = require("path");
const { JSDOM } = require("jsdom");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const { parse } = require("csv-parse");
const crypto = require("crypto");

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Global Variables
const TOKEN_PATH = "token.json";
const CREDENTIALS_PATH = "credentials.json";
const YAML_CONFIG = "google-crawl.yml";

// Main Functions

async function manageSheets(auth) {
  const sheets = google.sheets({
    version: "v4",
    auth,
  });
  let config = loadConfig();
  logMemoryUsage();
  for (const [site, entries] of Object.entries(config)) {
    for (let entry of entries) {
      const startTime = new Date();
      let reportPath = ""; // Reset path for each site

      console.log(`\n\n\n ++++====++++ \n\nStarting Scan for ${site}`);
      console.log(`Site URL (${startTime}): ${entry.url}`);

      // Ensure each site entry has a dedicated Google Sheet
      if (!entry.sheet_id) {
        const response = await sheets.spreadsheets.create({
          resource: {
            properties: {
              title: entry.name,
            },
          },
          fields: "spreadsheetId",
        });
        const sheetId = response.data.spreadsheetId;
        const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}`;

        entry.sheet_id = sheetId;
        entry.sheet_url = sheetUrl;
        console.log(`Created new sheet for ${site}: ${entry.url}`);
      }
      // console.log(`Current sheet ID ${entry.sheet_id} - ${entry.sheet_url} - ${entry.url}`);

      console.log(`Current Google Sheet URL ${entry.sheet_url}`);

      // Before the for loop, declare a flag indicating command success
      let commandSuccess = false;

      // Define the command to run purple-a11y
      const maxPages = entry.max || 5;

      const command = `node --max-old-space-size=4096 purple-a11y/cli.js -u ${entry.url} -c 2 -p ${entry.max} -k "Mike Gifford:mike.gifford@civicactions.com"`;

      // Await the completion of the command, including handling retries
      try {
        console.log(`Command: ${command}`);
        await runCommandWithTimeout(command);
        console.log("Purple A11y successfully run!");
        // Further processing after successful command execution
      } catch (error) {
        console.error("Command failed after all retries:", error);
        // Handle the error, possibly continue to the next site, or take other actions
      }

      insertTodaysDateInSummarySheet(auth, entry.sheet_id, entry.url); // Insert today's date in the Summary sheet

      // Process the results and update the Google Sheet
      try {
        // Find the most recent directory in the ./results/ directory
        const mostRecentDir = getMostRecentDirectory("./results", entry.url);
        const reportPath = path.join(
          "./results",
          mostRecentDir,
          "reports",
          "report.csv",
        );
        // console.log('Uploading report path:', reportPath);

        // Process the CSV report and prepare data
        // const summary = await analyzeCsvData(reportPath);

        // await updateSummarySheet(auth, entry.sheet_id, summary);

        // Optionally, call prepareDataForUpload if you need to process CSV data
        let processedRecords = await prepareDataForUpload(reportPath);

        // console.log('After prepareDataForUpload:', processedRecords);

        const endTime = new Date();
        const scanDuration = formatDuration((endTime - startTime) / 1000); // Duration in seconds

        // Upload the processed CSV report to the Google Sheet
        // await uploadToGoogleSheet(auth, entry.sheet_id, reportPath); // Adjust the argument if using processedRecords
        await uploadToGoogleSheet(
          auth,
          entry.sheet_id,
          processedRecords,
          scanDuration,
        );
        console.log(`Scan Duration: (${scanDuration})`);

        // Clear processed records to free up memory
        processedRecords = null;
      } catch (error) {
        console.error(
          "Error processing and uploading data for URL:",
          entry.url,
          error,
        );
      }
    }
  }

  // Save updated config back to YAML after all processing
  saveConfig(config);
}


/**
 * Runs a command with a specified timeout and retry logic.
 * @param {string} command The command to run.
 * @param {number} maxAttempts Maximum number of attempts to run the command.
 * @param {number} retryDelay Delay between retries in milliseconds.
 * @param {number} totalTimeout Total timeout for each command execution in milliseconds.
 */
async function runCommandWithTimeout(command, maxAttempts = 3, retryDelay = 300000, totalTimeout = 7200000) {
  let attempt = 0;
  
  while (attempt < maxAttempts) {
      attempt++;
      try {
          console.log(`Attempt ${attempt}: Executing command: ${command}`);
          // Wait for the command to complete or timeout. If it times out, execPromise will throw an error.
          const { stdout, stderr } = await execPromise(command, { timeout: totalTimeout });
          
          console.log(`Command succeeded on attempt ${attempt}`);
          console.log('stdout:', stdout);
          console.log('stderr:', stderr);
          return stdout; // Or return another relevant result based on your command
      } catch (error) {
          console.error(`Attempt ${attempt} failed: ${error.message}`);
          console.log('stderr:', error.stderr);
          if (attempt < maxAttempts) {
              console.log(`Waiting ${retryDelay / 1000} seconds before retrying...`);
              await new Promise(resolve => setTimeout(resolve, retryDelay));
          } else {
              throw new Error(`Command failed after ${maxAttempts} attempts: ${command}`);
          }
      }
  }
}


async function uploadToGoogleSheet(
  auth,
  spreadsheetId,
  processedRecords,
  scanDuration,
) {
  // console.log('Enter uploadToGoogleSheet:', processedRecords);
  logMemoryUsage();
  const sheets = google.sheets({
    version: "v4",
    auth,
  });
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
    console.log(
      `Uploaded data to '${sheetName}' in spreadsheet: ${spreadsheetId}`,
    );
  } catch (err) {
    console.error("Error uploading data to Google Sheets:", err);
  }

  processedRecords = null; // Clear the processed records to free up memory
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
  authorize(JSON.parse(content), manageSheets);
});

function getMostRecentDirectory(basePath, site) {
  const dirs = fs
    .readdirSync(basePath, {
      withFileTypes: true,
    })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => ({
      name: dirent.name,
      time: fs.statSync(path.join(basePath, dirent.name)).mtime.getTime(),
    }))
    // Sort directories by modified time descending
    .sort((a, b) => b.time - a.time);

  // Return the name of the most recent directory
  if (dirs.length > 0) {
    console.log(`Most recent directory for site ${site}: ${dirs[0].name}`);
    return dirs[0].name;
  } else {
    throw new Error("No directories found in basePath");
  }
}

function loadConfig() {
  try {
    return yaml.load(fs.readFileSync(YAML_CONFIG, "utf8"));
  } catch (e) {
    console.error(e);
    return {};
  }
}

function saveConfig(config) {
  try {
    fs.writeFileSync(YAML_CONFIG, yaml.dump(config), "utf8");
    console.log("Updated YAML configuration saved.");
  } catch (e) {
    console.error("Failed to save the updated configuration:", e);
  }
}

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
function parseCSV(data) {
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
// const fileContent = await fsPromises.readFile(filePath, "utf8");

// This function is correct as provided in your script, assuming all asynchronous calls are awaited properly within it.
async function prepareDataForUpload(filePath) {
  try {
    const fileContent = await fsPromises.readFile(filePath, "utf8");
    const records = await parseCSV(fileContent);
    return records.map(record => ({
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

async function updateSummarySheet(auth, spreadsheetId, summaryData) {
  const sheets = google.sheets({
    version: "v4",
    auth,
  });
  try {
    // Ensure "Summary" sheet exists or create it
    await ensureSheetExists(sheets, spreadsheetId, "Summary");

    // Append summary data to "Summary" sheet
    const range = "Summary!A:Z"; // Assuming summary fits within columns A to Z
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      resource: {
        values: [Object.values(summaryData)],
      },
    });
    console.log("Summary data updated.");
  } catch (error) {
    console.error("Failed to update summary sheet:", error);
  }
}

async function ensureSheetExists(sheets, spreadsheetId, sheetTitle) {
  const sheetMetadata = await sheets.spreadsheets.get({
    spreadsheetId,
  });
  const sheetExists = sheetMetadata.data.sheets.some(
    (sheet) => sheet.properties.title === sheetTitle,
  );

  if (!sheetExists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetTitle,
              },
            },
          },
        ],
      },
    });
  }
}

async function insertTodaysDateInSummarySheet(auth, spreadsheetId, url) {
  logMemoryUsage();
  const sheets = google.sheets({
    version: "v4",
    auth,
  });
  try {
    // Get the range of column A in the Summary sheet to find the first empty row
    const range = "Summary!A:A";
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    // Find the first empty row (if the cell is empty, it won't be included in values)
    const numRows = result.data.values ? result.data.values.length : 0;
    const firstEmptyRow = numRows + 1; // Add 1 because array is 0-indexed but Sheets rows start from 1

    // Format today's date as YYYY-MM-DD
    const today = new Date();
    const formattedDate = today.toISOString().split("T")[0];

    // Update the first empty cell in column A with today's date
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Summary!A${firstEmptyRow}`,
      valueInputOption: "USER_ENTERED",
      resource: {
        values: [[formattedDate]],
      },
    });

    console.log(
      `Inserted today's date (${formattedDate}) into the first empty row of the Summary sheet for ${url}.`,
    );
  } catch (err) {
    console.error("Error inserting today's date into the Summary sheet:", err);
  }
}

function logMemoryUsage() {
  const used = process.memoryUsage().heapUsed / 1024 / 1024;
  console.log(
    `The script uses approximately ${Math.round(used * 100) / 100} MB`,
  );
}
