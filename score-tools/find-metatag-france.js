/**
 * This script processes a CSV file of French government domains to identify
 * which domains are using Drupal as their CMS. The script performs the following steps:
 * 
 * 1. Reads the input CSV file containing the domain names and their HTTPS status.
 * 2. Initializes the output CSV file to store the domain names along with their Drupal meta tag content.
 * 3. For each domain:
 *    a. Constructs the URL and checks if the HTTPS status indicates that the site is live.
 *    b. Sends a GET request to the URL to fetch its HTML content.
 *    c. Parses the HTML content to look for meta tags indicating that the site is powered by Drupal.
 *    d. If a Drupal meta tag is found, appends the domain name and meta tag content to the output CSV file.
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
 * - Ensure that 'french-gov-domains.csv' exists in the same directory as this script.
 * - Run the script using Node.js: `node <script-name>.js`
 * - The output will be written to 'drupal-sites.csv' in the same directory.
 */


const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const axios = require('axios');
const { JSDOM } = require('jsdom');

const inputCsv = path.join(__dirname, 'french-gov-domains.csv');
const outputCsv = path.join(__dirname, 'drupal-sites.csv');

// Initialize the output CSV file with headers
fs.writeFileSync(outputCsv, 'domain_name,drupal_meta\n');

async function checkDrupalSite(url) {
  try {
    const response = await axios.get(url);
    const dom = new JSDOM(response.data);
    const metaTags = dom.window.document.querySelectorAll('meta[name="Generator"]');
    for (let metaTag of metaTags) {
      // if (metaTag.content.toLowerCase().includes('drupal')) {
        return metaTag.content;
      // }
    }
  } catch (error) {
    console.error(`Error checking ${url}: ${error.message}`);
  }
  return null;
}

function readCsv(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}

async function processDomains() {
  const domains = await readCsv(inputCsv);
  let count = 0;

  for (const domain of domains) {
    count++;
    const domainName = domain.domain_name || domain.name;
    const httpsStatus = domain.https_status || '';
    if (httpsStatus.includes('200') || httpsStatus.includes('301')) {
      const url = `https://${domainName}`;
      const drupalMeta = await checkDrupalSite(url);
      if (drupalMeta) {
        const result = {
          domain_name: domainName,
          drupal_meta: drupalMeta
        };
        appendResult(result);
        console.log(`Generator metatag found: ${domainName} - ${count}`);
      }
    } else {
      console.log(`Metatags not found ${domainName} - ${count}`);   
    }
  }

  console.log(`Finished processing.`);
}

function appendResult(result) {
  const csvRow = `${result.domain_name},${result.drupal_meta}\n`;
  fs.appendFileSync(outputCsv, csvRow);
}

async function main() {
  await processDomains();
}

main().catch(error => console.error(`Error: ${error.message}`));
