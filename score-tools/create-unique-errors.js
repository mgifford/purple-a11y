const fs = require('fs');
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');
const crypto = require('crypto');
const { JSDOM } = require('jsdom');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// Setup the command line arguments
const argv = yargs(hideBin(process.argv)).options({
  f: { type: 'string', demandOption: true, alias: 'file' },
  o: { type: 'string', alias: 'output' }
}).argv;

function generateMD5Hash(data) {
  return crypto.createHash('md5').update(data).digest('hex');
}

function sanitizeHtml(html) {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  // Remove unwanted attributes and text nodes
  function cleanse(node) {
    node.querySelectorAll('*').forEach((el) => {
      el.removeAttribute('title');
      el.removeAttribute('href');
      // If you need to remove any other attributes, do it here.
      if (el.hasChildNodes()) {
        el.childNodes.forEach((child) => {
          if (child.nodeType === dom.window.Node.TEXT_NODE) {
            // Replace nbsp and other HTML entities
            const textContent = child.textContent.replace(/&nbsp;|[\u00A0]/g, '').trim();
            if (textContent === '') {
              child.remove();
            } else {
              child.textContent = ' ';
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

function processCSV(inputFile, outputFile) {
  const results = [];
  const header = [];
  let firstRow = true;
  const xpathCountMap = new Map();
  const uniqueIdentifierCountMap = new Map();
  const htmlFingerprintCountMap = new Map();

  fs.createReadStream(inputFile)
    .pipe(csv())
    .on('data', (row) => {
      if (firstRow) {
        Object.keys(row).forEach((key) => {
          if (key !== 'learnMore') { // Exclude 'learnMore' from header
            header.push({ id: key, title: key });
          }
        });
        header.push({ id: 'xpathCount', title: 'xpathCount' });
        header.push({ id: 'uniqueIdentifier', title: 'uniqueIdentifier' });
        header.push({ id: 'uniqueIdentifierCount', title: 'uniqueIdentifierCount' });
        header.push({ id: 'htmlFingerprint', title: 'htmlFingerprint' });
        header.push({ id: 'htmlFingerprintCount', title: 'htmlFingerprintCount' });
        firstRow = false;
      }
      const strippedHtml = sanitizeHtml(row.context || '');
      const htmlFingerprint = generateMD5Hash(strippedHtml);
      const uniqueIdentifier = generateMD5Hash(`${row.url}${row.xpath}`);
      results.push({ ...row });
      
      // Count occurrences of xpath
      const xpath = row.xpath;
      xpathCountMap.set(xpath, (xpathCountMap.get(xpath) || 0) + 1);
      
      // Count occurrences of uniqueIdentifier
      uniqueIdentifierCountMap.set(uniqueIdentifier, (uniqueIdentifierCountMap.get(uniqueIdentifier) || 0) + 1);
      
      // Count occurrences of htmlFingerprint
      htmlFingerprintCountMap.set(htmlFingerprint, (htmlFingerprintCountMap.get(htmlFingerprint) || 0) + 1);
    })
    .on('end', () => {
      // Add counts to each row
      results.forEach(result => {
        result.xpathCount = xpathCountMap.get(result.xpath) || 0;
        result.uniqueIdentifier = generateMD5Hash(`${result.url}${result.xpath}`);
        result.uniqueIdentifierCount = uniqueIdentifierCountMap.get(generateMD5Hash(`${result.url}${result.xpath}`)) || 0;
        result.htmlFingerprint = generateMD5Hash(sanitizeHtml(result.context || ''));
        result.htmlFingerprintCount = htmlFingerprintCountMap.get(generateMD5Hash(sanitizeHtml(result.context || ''))) || 0;
      });

      const csvWriter = createObjectCsvWriter({
        path: outputFile,
        header: header
      });
      
      csvWriter.writeRecords(results)
        .then(() => {
          console.log(`The CSV file was written successfully to ${outputFile}`);
        });
    });
}


// Determine the output file name based on input or provided output argument
const outputFile = argv.o || (argv.f.substring(0, argv.f.lastIndexOf('.')) + '-processed.csv');

// Call the processCSV function with the arguments provided
processCSV(argv.f, outputFile);
