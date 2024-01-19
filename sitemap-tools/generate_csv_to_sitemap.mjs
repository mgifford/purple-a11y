import axios from 'axios';
import csv from 'csv-parser';
import fs from 'fs';
import { Builder } from 'xml2js';

const checkedUrls = new Set();
const duplicateUrls = new Set();
const failedUrls = [];
let urlCheckCount = 0;

function isValidHttpUrl(string) {
    try {
        new URL(string);
    } catch (_) {
        return false;
    }
    return true;
}

async function isUrlValid(url) {
    try {
        const response = await axios.head(url, { timeout: 10000, maxRedirects: 10 });
        return response.status === 200;
    } catch (error) {
        if (error.response) {
            console.error(`Error checking URL ${url}: Server responded with status code ${error.response.status}`);
        } else if (error.request) {
            console.error(`Error checking URL ${url}: No response received.`);
        } else {
            console.error(`Error checking URL ${url}: ${error.message}`);
        }
        failedUrls.push(url);
        return false;
    }
}

async function preprocessUrl(url) {
    const fullUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
    console.log(`Processing URL: ${fullUrl}`);

    if (!isValidHttpUrl(fullUrl)) {
        console.error(`Invalid URL format after processing: ${fullUrl}`);
        failedUrls.push(fullUrl);
        return null;
    }

    return fullUrl;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function verifyAndProcessUrl(url) {
    urlCheckCount++;
    console.log(`Checking URL ${urlCheckCount}: ${url}`);

    await sleep(1000); // Delay of 1 second

    if (checkedUrls.has(url)) {
        console.log(`Duplicate URL skipped: ${url}`);
        duplicateUrls.add(url);
        return null;
    }

    checkedUrls.add(url);

    try {
        const response = await axios.get(url, { timeout: 10000, maxRedirects: 10 });
        if (response.status === 200) {
            const finalUrl = response.request.res.responseUrl || url;
            console.log(`URL verified: ${finalUrl}`);
            return finalUrl.endsWith('.pdf') || finalUrl.endsWith('.xml') ? null : finalUrl;
        }
    } catch (error) {
        if (error.response) {
            // The request was made and the server responded with a status code
            console.error(`Error checking URL ${url}: Server responded with status code ${error.response.status}`);
        } else if (error.request) {
            // The request was made but no response was received
            console.error(`Error checking URL ${url}: No response received.`);
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error(`Error checking URL ${url}: ${error.message}`);
        }
        failedUrls.push(url);
    }
    return null;
}


function readCsv(csvFile) {
    return new Promise((resolve, reject) => {
        const urls = [];
        fs.createReadStream(csvFile)
            .pipe(csv())
            .on('data', (row) => {
                const url = Object.values(row)[0].trim();
                if (url) {
                    urls.push(url);
                } else {
                    console.error(`Invalid or empty URL found in CSV: ${JSON.stringify(row)}`);
                }
            })
            .on('end', () => {
                console.log(`Finished reading CSV. Total URLs found: ${urls.length}`);
                resolve(urls);
            })
            .on('error', (error) => reject(error));
    });
}

function generateSitemap(urls, outputFile) {
    const urlset = {
        urlset: {
            $: { xmlns: 'http://www.sitemaps.org/schemas/sitemap/0.9' },
            url: urls.map(url => ({ loc: url }))
        }
    };

    const builder = new Builder();
    const xml = builder.buildObject(urlset);
    fs.writeFileSync(outputFile, xml, 'utf-8');
    console.log(`Sitemap generated with ${urls.length} valid URLs. Saved to ${outputFile}`);
}

async function main() {
    if (process.argv.length < 4) {
        console.error('Usage: node script.js <csv_file> <output_file>');
        return;
    }

    const csvFile = process.argv[2];
    const outputFile = process.argv[3];

    try {
        const urlsFromCsv = await readCsv(csvFile);
        const preprocessedUrls = await Promise.all(urlsFromCsv.map(preprocessUrl));
        const processedUrls = await Promise.all(preprocessedUrls.filter(url => url).map(verifyAndProcessUrl));
        const validUrls = processedUrls.filter(url => url);

        if (validUrls.length === 0) {
            console.log("No valid URLs found. Exiting.");
            return;
        }

        generateSitemap(validUrls, outputFile);

        if (duplicateUrls.size > 0) {
            console.log(`Duplicate URLs found: ${Array.from(duplicateUrls).join(', ')}`);
        }
        if (failedUrls.length > 0) {
            console.log(`Failed URLs: ${failedUrls.join(', ')}`);
        }
    } catch (error) {
        console.error(`Error in main: ${error}`);
    }
}

main().catch(console.error);
