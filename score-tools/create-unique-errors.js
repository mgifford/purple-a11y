const fs = require('fs');
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');
const crypto = require('crypto');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const argv = yargs(hideBin(process.argv)).options({
  t: { type: 'string', demandOption: true, alias: 'type' },
  f: { type: 'string', demandOption: true, alias: 'file' },
  o: { type: 'string', alias: 'output' }
}).argv;

function generateMD5Hash(data) {
  return crypto.createHash('md5').update(data).digest('hex');
}

function processCSV(inputFile, outputFile, type) {
  const results = [];
  const header = [];
  let firstRow = true;

  fs.createReadStream(inputFile)
    .pipe(csv())
    .on('data', (row) => {
      if (firstRow) {
        Object.keys(row).forEach((key) => header.push({ id: key, title: key }));
        header.push({ id: 'uniqueIdentifier', title: 'uniqueIdentifier' });
        firstRow = false;
      }
      // Depending on the file type, concatenate the correct fields to generate the hash
      const dataToHash = type === 'pa11y' ? `${row.xpath}${row.url}` : `${row.url}${row.xpath}`;
      const uniqueIdentifier = generateMD5Hash(dataToHash);
      results.push({ ...row, uniqueIdentifier });
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
const outputFile = argv.o || (argv.f.substring(0, argv.f.lastIndexOf('.')) + '-unique.csv');

// Call the processCSV function with the arguments provided
processCSV(argv.f, outputFile, argv.t);

