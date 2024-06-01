const axios = require('axios');
const { google } = require('googleapis');
const fs = require('fs');
const yaml = require('js-yaml');
const { parse } = require('csv-parse/sync');
const { Command } = require('commander');

const program = new Command();
program.version('0.1.0');
program
  .option('-u, --url <type>', 'Add a single URL')
  .option('-f, --file <type>', 'Add URLs from a CSV file');

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// Authenticate with Google Sheets API
const authenticateGoogleSheets = async () => {
    const credentials = JSON.parse(fs.readFileSync('credentials.json', 'utf8'));
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    const token = JSON.parse(fs.readFileSync('token.json', 'utf8'));
    oAuth2Client.setCredentials(token);
    return oAuth2Client;
};

// Check and extract URL and title
const checkUrl = async (url) => {
    try {
        const response = await axios.get(url);
        return { url: response.request.res.responseUrl, title: response.data.match(/<title>(.*?)<\/title>/i)[1] };
    } catch (error) {
        console.error('Failed to retrieve URL:', url, error);
        return null;
    }
};

// Create a new Google Sheet and return its ID and URL
async function createNewSheet(auth, title) {
    const sheets = google.sheets({version: 'v4', auth});
    const request = {
      resource: {
        properties: {
          title: title
        }
      }
    };

    try {
      const response = await sheets.spreadsheets.create(request);
      const sheetId = response.data.spreadsheetId;
      const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
      console.log('Spreadsheet ID:', sheetId);
      console.log('Spreadsheet URL:', sheetUrl);
      return { sheetId, sheetUrl };
    } catch (err) {
      console.error('Failed to create spreadsheet:', err.message);
    }
}

// Update YAML file with new data
const updateYAML = (filePath, data) => {
    let doc = yaml.load(fs.readFileSync(filePath, 'utf8')) || {};
    if (!doc[data.url]) { // Check if URL already exists
        doc[data.url] = [{ ...data }];
        fs.writeFileSync(filePath, yaml.dump(doc));
        console.log('Added new entry:', data);
    } else {
        console.log('Entry already exists for URL:', data.url);
    }
};

// Generate a random day of the week
const getRandomDay = () => {
    return weekdays[Math.floor(Math.random() * weekdays.length)];
};

// Process each URL: check, create sheet, and update YAML
const processUrl = async (url) => {
    const existingEntries = yaml.load(fs.readFileSync('unlighthouse_sites.yml', 'utf8')) || {};
    if (existingEntries[url]) {
        console.log('URL already exists:', url);
        return;
    }

    const urlData = await checkUrl(url);
    if (!urlData) return;

    const auth = await authenticateGoogleSheets();
    const { sheetId, sheetUrl } = await createNewSheet(auth, urlData.title);

    const newData = {
        url: urlData.url,
        name: urlData.title,
        sheet_id: sheetId,
        sheet_url: sheetUrl,
        start_date: getRandomDay(), // Set a random day
        max: 500
    };
    updateYAML('unlighthouse_sites.yml', newData);
};

// Main function to parse arguments and process URLs or files
const main = () => {
    program.parse(process.argv);
    const options = program.opts();
    if (options.url) {
        processUrl(options.url);
    } else if (options.file) {
        const content = fs.readFileSync(options.file, 'utf8');
        const records = parse(content, { columns: false });
        records.forEach(record => {
            const url = record[0].trim();
            processUrl(url);
        });
    }
};

main();
