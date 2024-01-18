import axios from 'axios';
import csv from 'csv-parser';
import fs from 'fs';
import { Builder } from 'xml2js';
import { URL } from 'url';

let urlCheckCount = 0;
const failedUrls = [];
const finalUrls = new Map();

async function isUrlValid(url) {
    urlCheckCount++;
    console.log(`Checking URL ${urlCheckCount}: ${url}`);

    try {
        const response = await axios.head(url, { timeout: 5000, maxRedirects: 5 });
        if (response.status === 200) {
            const finalUrl = response.request.res.responseUrl;
            finalUrls.set(url, finalUrl);
            if (url !== finalUrl) {
                console.log(`Redirect: ${url} -> ${finalUrl}`);
            }
            return true;
        } else {
            return false;
        }
    } catch (error) {
        console.error(`Error checking URL ${url}: ${error}`);
        return false;
    }
}

async function preprocessUrl(url) {
    const urlPrefixes = ["https://www.", "https://", "http://www.", "http://"];

    for (let prefix of urlPrefixes) {
        let modifiedUrl = prefix + url;
        if (await isUrlValid(modifiedUrl)) {
            return finalUrls.get(modifiedUrl);
        } else {
            failedUrls.push(modifiedUrl);
        }
    }
    return url;
}

function readCsv(csvFile) {
    return new Promise((resolve, reject) => {
        const urls = [];
        fs.createReadStream(csvFile)
            .pipe(csv())
            .on('data', (row) => urls.push(row[0].trim()))
            .on('end', () => resolve(urls))
            .on('error', (error) => reject(error));
    });
}

function generateSitemap(urls, outputFile) {
    const urlset = {
        urlset: {
            $: { xmlns: 'http://www.sitemaps.org/schemas/sitemap/0.9' },
            url: urls.filter(url => !url.endsWith('.pdf') && !url.endsWith('.xml'))
                   .map(url => ({ loc: url }))
        }
    };

    const builder = new Builder();
    const xml = builder.buildObject(urlset);
    fs.writeFileSync(outputFile, xml, 'utf-8');
}

async function main() {
    const [csvFile, outputFile] = process.argv.slice(2);

    if (!csvFile || !outputFile) {
        console.error('Usage: node script.js <csv_file> <output_file>');
        return;
    }

    const urls = await readCsv(csvFile);
    const preprocessedUrls = await Promise.all(urls.map(preprocessUrl));
    const validUrls = preprocessedUrls.filter(url => url);

    if (validUrls.length === 0) {
        console.log("No valid URLs found. Exiting.");
        return;
    }

    generateSitemap(validUrls, outputFile);
    console.log(`Sitemap generated with ${validUrls.length} valid URLs. Saved to ${outputFile}`);
}

main().catch(console.error);
