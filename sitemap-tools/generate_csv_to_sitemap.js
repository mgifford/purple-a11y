import axios from 'axios';
import cheerio from 'cheerio';
import { RobotsParser } from 'robotstxt';
import { Builder } from 'xml2js';
import fs from 'fs';
import { URL } from 'url';

let urlCheckCount = 0;

async function canFetch(robotsParser, url) {
    urlCheckCount++;
    console.log(`Found URL ${urlCheckCount}: ${url}`);
    return await robotsParser.canCrawl('*', url);
}

async function crawlSite(startUrl) {
    const visited = new Set();
    const urlsToVisit = new Set([startUrl]);
    const uniqueUrls = new Set();
    const domain = new URL(startUrl).hostname;

    const robotsParser = new RobotsParser(`http://${domain}/robots.txt`);
    await robotsParser.read();

    while (urlsToVisit.size > 0) {
        const currentUrl = urlsToVisit.values().next().value;
        urlsToVisit.delete(currentUrl);
        visited.add(currentUrl);

        if (!(await canFetch(robotsParser, currentUrl))) {
            continue;
        }

        try {
            const response = await axios.get(currentUrl, { timeout: 5000 });
            if (response.status !== 200 || !response.headers['content-type'].includes('text/html')) {
                continue;
            }

            const $ = cheerio.load(response.data);
            $('a[href]').each((i, link) => {
                const href = $(link).attr('href');
                const fullUrl = new URL(href, currentUrl).href;
                if (new URL(fullUrl).hostname === domain && !visited.has(fullUrl) && !urlsToVisit.has(fullUrl)) {
                    urlsToVisit.add(fullUrl);
                }
            });

            if (!currentUrl.endsWith('.pdf') && !currentUrl.endsWith('.xml')) {
                uniqueUrls.add(currentUrl);
            }
        } catch (error) {
            console.error(`Error crawling ${currentUrl}: ${error.message}`);
        }
    }

    return uniqueUrls;
}

function generateSitemap(urls, outputFile) {
    const urlset = {
        urlset: {
            $: {
                xmlns: 'http://www.sitemaps.org/schemas/sitemap/0.9'
            },
            url: Array.from(urls).map(url => ({ loc: url }))
        }
    };

    const builder = new Builder({ headless: true, pretty: true });
    const xml = builder.buildObject(urlset);

    fs.writeFileSync(outputFile, xml, 'utf-8');
}

async function main() {
    const args = process.argv.slice(2);
    const siteUrl = args[0];
    const outputFile = args[1];

    if (!siteUrl || !outputFile) {
        console.error('Usage: node script.js <site_url> <output_file>');
        process.exit(1);
    }

    const urls = await crawlSite(siteUrl);
    generateSitemap(urls, outputFile);
    console.log(`Sitemap generated with ${urls.size} unique URLs. Saved to ${outputFile}`);
}

main().catch(console.error);
