import axios from 'axios';
import csv from 'csv-parser';
import fs from 'fs';
import { Builder } from 'xml2js';

const checkedUrls = new Set();
const failedUrls = [];
let urlCheckCount = 0;

function preprocessUrl(url) {
    let fullUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
    const urlObj = new URL(fullUrl);
    if (!urlObj.hostname.startsWith('www.')) {
        urlObj.hostname = 'www.' + urlObj.hostname;
    }
    fullUrl = urlObj.toString();
    console.log(`Processed URL: ${fullUrl}`);
    return fullUrl;
}

async function verifyAndProcessUrl(url) {
    urlCheckCount++;
    console.log(`Checking URL ${urlCheckCount}: ${url}`);

    if (checkedUrls.has(url)) {
        console.log(`Duplicate URL skipped: ${url}`);
        return null;
    }

    checkedUrls.add(url);

    try {
        const response = await axios.get(url, {
            timeout: 15000,
            maxRedirects: 15,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36'
            }
        });

        const finalUrl = response.request.res ? response.request.res.responseUrl : response.request.responseURL;

        if (response.status === 200) {
            if (finalUrl && url !== finalUrl) {
                console.log(`Redirected URL: Original: ${url}, Final: ${finalUrl}`);
            } else {
                console.log(`URL verified: ${url}`);
            }
            return finalUrl || url;
        }
    } catch (error) {
        if (error.response) {
            console.error(`Error checking URL ${url}: Server responded with status code ${error.response.status}, status text: ${error.response.statusText}`);
        } else if (error.request) {
            console.error(`Error checking URL ${url}: No response received.`);
        } else {
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
                    urls.push(preprocessUrl(url));
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
        const processedUrls = await Promise.all(urlsFromCsv.filter(url => url).map(verifyAndProcessUrl));
        const validUrls = processedUrls.filter(url => url);

        if (validUrls.length === 0) {
            console.log("No valid URLs found. Exiting.");
            return;
        }

        generateSitemap(validUrls, outputFile);

        if (failedUrls.length > 0) {
            console.log(`Failed URLs: ${failedUrls.join(', ')}`);
        }
    } catch (error) {
        console.error(`Error in main: ${error}`);
    }
}

main().catch(console.error);
