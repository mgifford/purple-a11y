/**
 * This script processes a CSV file containing U.S. government domain URLs to identify
 * which domains have specific meta tags (e.g., Generator meta tags) in their HTML content.
 * The script performs the following steps:
 * 
 * 1. Reads the input CSV file containing the domain names and associated metadata.
 * 2. Initializes the output CSV file to store the domain names along with their meta tag content.
 * 3. For each domain:
 *    a. Constructs the URL and fetches the HTML content of the site.
 *    b. Parses the HTML content to look for specific meta tags (e.g., Generator meta tags).
 *    c. If the meta tags are found, appends the domain name and meta tag content to the output CSV file.
 * 4. Logs the progress and errors during the execution.
 * 
 * Dependencies:
 * - 'fs' for file system operations.
 * - 'path' for handling file paths.
 * - 'csv-parser' for parsing CSV files.
 * - 'axios' for making HTTP requests.
 * - 'jsdom' for parsing HTML content.
 * 
 * Usage:
 * - Ensure that '1_govt_urls_full.csv' exists in the same directory as this script.
 * - Run the script using Node.js: `node <script-name>.js`
 * - The output will be written to 'us-gov-metatags-sites.csv' in the same directory.
 * 
 * Also see: find-metatag-france.js
*/

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const axios = require('axios');
const { JSDOM } = require('jsdom');

const inputCsv = path.join(__dirname, '1_govt_urls_full.csv');
const outputCsv = path.join(__dirname, 'us-gov-metatags-sites.csv');

// Initialize the output CSV file with headers
fs.writeFileSync(outputCsv, 'domain_name,generator_meta\n');

async function checkMetaTags(url) {
  try {
    console.log(`Fetching URL: ${url}`);
    const response = await axios.get(url);
    const dom = new JSDOM(response.data);
    const metaTags = dom.window.document.querySelectorAll('meta[name="Generator"]');
    const metaContents = [];
    for (let metaTag of metaTags) {
      metaContents.push(metaTag.content);
    }
    return metaContents.length > 0 ? metaContents.join('; ') : null;
  } catch (error) {
    console.error(`Error checking ${url}: ${error.message}`);
  }
  return null;
}

function removeBOM(buffer) {
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.slice(3);
  }
  return buffer;
}

function readCsv(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    const readStream = fs.createReadStream(filePath);
    readStream.once('data', (chunk) => {
      const cleanedChunk = removeBOM(chunk);
      const tempFilePath = path.join(__dirname, 'temp_cleaned.csv');
      fs.writeFileSync(tempFilePath, cleanedChunk);
      readStream
        .pipe(csv({ headers: ['Domain name', 'Agency', 'Maintaining office', 'Use case', 'Type of government', 'Federal branch', 'State', 'Comments', 'Link', 'Date Added'], skipLines: 1 }))
        .on('data', (data) => {
          console.log(`Read row: ${JSON.stringify(data)}`);
          if (data['Domain name'] && data['Domain name'].trim() !== '') {
            results.push(data);
            console.log(`Valid domain found: ${data['Domain name']}`);
          } else {
            console.log(`Skipping empty domain at row ${results.length + 1}`);
          }
        })
        .on('end', () => {
          console.log(`Finished reading CSV. Total valid rows: ${results.length}`);
          fs.unlinkSync(tempFilePath); // Clean up the temporary file
          resolve(results);
        })
        .on('error', (error) => {
          console.error(`Error reading CSV: ${error.message}`);
          reject(error);
        });
    });
  });
}

async function processDomains() {
  const domains = await readCsv(inputCsv);
  console.log(`Processing ${domains.length} domains...`);
  let count = 0;

  for (const domain of domains) {
    count++;
    const domainName = domain['Domain name'].trim();
    if (!domainName) {
      console.log(`Skipping empty domain name at count ${count}`);
      continue;
    }

    console.log(`Processing domain: ${domainName} (${count})`);
    const url = `https://${domainName}`;
    const metaTags = await checkMetaTags(url);
    if (metaTags) {
      const result = {
        domain_name: domainName,
        generator_meta: metaTags
      };
      appendResult(result);
      console.log(`Metatags found: ${domainName} - ${count}`);
    } else {
      console.log(`Metatags not found for ${domainName} - ${count}`);
    }
  }

  console.log(`Finished processing.`);
}

function appendResult(result) {
  const csvRow = `${result.domain_name},${result.generator_meta}\n`;
  fs.appendFileSync(outputCsv, csvRow);
}

async function main() {
  console.log(`Starting processing...`);
  await processDomains();
}

main().catch(error => console.error(`Error: ${error.message}`));
