// Todo
// Test against <tr><td> elements. 

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

  fs.createReadStream(inputFile)
    .pipe(csv())
    .on('data', (row) => {
      if (firstRow) {
        Object.keys(row).forEach((key) => header.push({ id: key, title: key }));
        header.push({ id: 'uniqueIdentifier', title: 'uniqueIdentifier' });
        header.push({ id: 'strippedHtml', title: 'StrippedHtml' });
        header.push({ id: 'htmlFingerprint', title: 'HtmlFingerprint' });
        firstRow = false;
      }
      const strippedHtml = sanitizeHtml(row.context || '');
      const htmlFingerprint = generateMD5Hash(strippedHtml);
      const uniqueIdentifier = generateMD5Hash(`${row.url}${row.xpath}`);
      results.push({ ...row, uniqueIdentifier, strippedHtml, htmlFingerprint });
    })
    .on('end', () => {
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
