const fs = require('fs');
const csvParser = require('csv-parser');
const yargs = require('yargs');
const { promisify } = require('util');
const { pipeline } = require('stream');

// Promisify the stream pipeline function for easier error handling
const pipelineAsync = promisify(pipeline);

// Define command line options using yargs
const argv = yargs
    .options({
        'c': {
            alias: 'csv',
            describe: 'Input CSV file path',
            demandOption: true,
            type: 'string'
        },
        'o': {
            alias: 'output',
            describe: 'Output sitemap.xml file path',
            demandOption: true,
            type: 'string'
        },
        'r': {
            alias: 'randomize',
            describe: 'Randomize the order of URLs in the sitemap',
            type: 'boolean',
            default: false
        }
    })
    .help()
    .alias('h', 'help')
    .argv;

// Function to shuffle an array (Fisher-Yates shuffle algorithm)
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]]; // Swap elements
    }
}

// Function to convert CSV to sitemap.xml format with optional URL randomization
async function convertToSitemap(csvFilePath, sitemapFilePath, randomize = false) {
    let urls = [];

    // Read URLs from CSV and store in an array
    const readStream = fs.createReadStream(csvFilePath);
    const csvStream = csvParser({ headers: false });
    csvStream.on('data', (row) => urls.push(row[0]));

    try {
        // Use pipeline to handle backpressure and errors properly
        await pipelineAsync(readStream, csvStream);

        // If randomization is enabled, shuffle the URLs array
        if (randomize) {
            shuffleArray(urls);
        }

        // Write the XML structure to the file
        const writeStream = fs.createWriteStream(sitemapFilePath);
        writeStream.write('<?xml version="1.0" encoding="UTF-8"?>\n');
        writeStream.write('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n');

        // Write each URL (shuffled or in original order) to the sitemap
        urls.forEach(url => {
            writeStream.write(`  <url><loc>${url}</loc></url>\n`);
        });

        writeStream.write('</urlset>');
        writeStream.end(); // Properly close the write stream

        writeStream.on('error', (err) => {
            console.error('Error writing to sitemap.xml:', err);
        });

        writeStream.on('finish', () => {
            console.log('Conversion completed!');
        });
    } catch (error) {
        console.error('Error processing CSV file:', error);
    }
}

// Call the function with command line arguments
convertToSitemap(argv.csv, argv.output, argv.randomize);
