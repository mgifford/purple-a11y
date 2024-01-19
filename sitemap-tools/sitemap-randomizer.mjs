import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import { Builder } from 'xml2js'; // Corrected import for xml2js Builder
import { promises as fsPromises } from 'fs';
import yargs from 'yargs';
import { createObjectCsvWriter } from 'csv-writer';

async function getSitemapUrls(url) {
    try {
        const response = await axios.get(url);
        const xmlContent = response.data;

        const parsed = await parseStringPromise(xmlContent, { explicitArray: false, normalizeTags: true });
        const urls = parsed.urlset.url.map(u => u.loc);

        if (parsed.urlset.sitemap) {
            const sitemaps = Array.isArray(parsed.urlset.sitemap) ? parsed.urlset.sitemap : [parsed.urlset.sitemap];
            for (const sitemap of sitemaps) {
                const nestedUrls = await getSitemapUrls(sitemap.loc);
                urls.push(...nestedUrls);
            }
        }

        return urls;
    } catch (error) {
        console.error(`Error fetching sitemap: ${error}`);
        return [];
    }
}

function filterAndRandomizeUrls(urls, excludeStrings, includeStrings) {
    const excludedExtensions = ['pdf', 'zip', 'txt', 'pptx', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'rss', 'xml'];

    let filteredUrls = urls.filter(url => !excludedExtensions.some(ext => url.endsWith('.' + ext)));
    
    if (excludeStrings.length) {
        filteredUrls = filteredUrls.filter(url => !excludeStrings.some(exclude => url.includes(exclude)));
    }
    if (includeStrings.length) {
        filteredUrls = filteredUrls.filter(url => includeStrings.some(include => url.includes(include)));
    }

    return filteredUrls.sort(() => 0.5 - Math.random());
}

async function saveUrlsToXml(urls, filename) {
    const urlsetXml = {
        urlset: {
            $: { xmlns: 'http://www.sitemaps.org/schemas/sitemap/0.9' },
            url: urls.map(url => ({ loc: url }))
        }
    };

    const builder = new Builder(); // Use the Builder here
    const xml = builder.buildObject(urlsetXml);
    await fsPromises.writeFile(filename, xml, 'utf-8');
}

async function saveUrlsToCsv(urls, filename) {
    const csvWriter = createObjectCsvWriter({
        path: filename,
        header: [{id: 'loc', title: 'LOC'}]
    });

    await csvWriter.writeRecords(urls.map(url => ({ loc: url })));
}

async function main() {
    const argv = yargs(process.argv.slice(2))
        .option('u', {
            alias: 'url',
            describe: 'The URL of the sitemap',
            type: 'string',
            demandOption: true
        })
        .option('n', {
            alias: 'number',
            describe: 'The number of URLs to retrieve',
            type: 'number',
            default: 2000
        })
        .option('e', {
            alias: 'exclude',
            describe: 'Strings to exclude from URLs',
            type: 'array',
            default: []
        })
        .option('i', {
            alias: 'include',
            describe: 'Strings to force inclusion from URLs',
            type: 'array',
            default: []
        })
        .option('f', {
            alias: 'format',
            describe: 'Output format',
            choices: ['xml', 'csv'],
            default: 'xml'
        })
        .argv;

    const urls = await getSitemapUrls(argv.url);
    const filteredUrls = filterAndRandomizeUrls(urls, argv.exclude, argv.include).slice(0, argv.number);

    const outputFilename = `output-${Date.now()}.${argv.format}`;
    if (argv.format === 'xml') {
        await saveUrlsToXml(filteredUrls, outputFilename);
    } else {
        await saveUrlsToCsv(filteredUrls, outputFilename);
    }

    console.log(`Output saved to ${outputFilename}`);
}

main().catch(console.error);
