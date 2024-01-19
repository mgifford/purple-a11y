import axios from 'axios';
import { createObjectCsvWriter as createCsvWriter } from 'csv-writer';
import fs from 'fs';
import csv from 'csv-parser';
import { URL } from 'url';
import xml2js from 'xml2js';

async function isSitemapValid(xmlContent) {
    try {
        const parser = new xml2js.Parser({ strict: false, trim: true });
        await parser.parseStringPromise(xmlContent);
        return true;
    } catch (error) {
        return false;
    }
}

async function checkSitemap(url) {
    try {
        const response = await axios.get(url, { timeout: 5000 });
        if (response.status === 200 && await isSitemapValid(response.data)) {
            return url;
        }
        return '';
    } catch (error) {
        return '';
    }
}

async function getValidDomains(domains) {
    const validDomains = new Set();
    const failedDomains = new Set();

    for (let domain of domains) {
        try {
            const response = await axios.get(domain, { timeout: 5000 });
            if (response.status === 200) {
                const sitemapUrl = new URL('/sitemap.xml', response.config.url).toString();
                const sitemap = await checkSitemap(sitemapUrl);
                if (sitemap) {
                    validDomains.add(sitemap);
                } else {
                    validDomains.add(new URL('/', response.config.url).toString());
                    failedDomains.add(domain);
                }
            }
        } catch (error) {
            console.error(`Error processing domain ${domain}: ${error}`);
            failedDomains.add(domain);
        }
    }
    return { validDomains, failedDomains };
}

async function readDomainsFromCsv(filePath) {
    return new Promise((resolve, reject) => {
        const domains = new Set();
        fs.createReadStream(filePath)
            .on('data', (chunk) => {
                // Split the chunk by new lines and trim each line
                const lines = chunk.toString().split('\n');
                for (const line of lines) {
                    if (line.trim()) {
                        console.log(`Read domain: ${line.trim()}`);
                        domains.add(line.trim());
                    }
                }
            })
            .on('end', () => resolve(domains))
            .on('error', (error) => reject(error));
    });
}


async function writeDomainsToCsv(filePath, domains) {
    const csvWriter = createCsvWriter({
        path: filePath,
        header: [{id: 'domain', title: 'DOMAIN'}]
    });

    const records = Array.from(domains).map(domain => ({ domain }));
    await csvWriter.writeRecords(records);
}

async function main() {
    const inputDomains = await readDomainsFromCsv('domain_source.csv');
    const { validDomains, failedDomains } = await getValidDomains(inputDomains);

    const urls = await readDomainsFromCsv('domain_source.csv');
    console.log(`Total domains read: ${urls.size}`);

    await writeDomainsToCsv('sitemap_extracts.csv', validDomains);
    await writeDomainsToCsv('sitemap_failures.csv', failedDomains);

    console.log("Domains with sitemaps:");
    validDomains.forEach(domain => console.log(domain));

    console.log("\nDomains without sitemaps:");
    failedDomains.forEach(domain => console.log(domain));
}

main().catch(console.error);
