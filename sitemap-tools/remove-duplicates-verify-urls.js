const fs = require('fs');
const https = require('https');
const readline = require('readline');
const url = require('url');
const path = require('path');
const process = require('process');

function normalizeUrl(inputUrl) {
    if (!inputUrl.startsWith('http://') && !inputUrl.startsWith('https://')) {
        inputUrl = 'https://' + inputUrl;
    }
    const parsedUrl = new URL(inputUrl);
    parsedUrl.hostname = parsedUrl.hostname.replace(/^www\./, '');
    parsedUrl.protocol = 'https:';
    return parsedUrl.toString();
}

function shouldIncludeUrl(inputUrl, excludedExtensions) {
    const extname = path.extname(url.parse(inputUrl).pathname);
    return !excludedExtensions.includes(extname);
}

function crawlUrl(inputUrl) {
    return new Promise((resolve, reject) => {
        https.get(inputUrl, (response) => {
            if (response.statusCode === 200) {
                resolve({ resolvedUrl: inputUrl, originalUrl: null, isRedirected: false });
            } else if (response.statusCode >= 300 && response.statusCode < 400) {
                resolve({ resolvedUrl: response.headers.location, originalUrl: inputUrl, isRedirected: true });
            } else {
                reject(new Error(`Invalid URL: ${inputUrl} - Status Code: ${response.statusCode}`));
            }
        }).on('error', (error) => {
            reject(new Error(`Invalid URL: ${inputUrl} - Error: ${error.message}`));
        });
    });
}

async function processUrls(inputFile, excludedExtensions) {
    const urls = new Set();
    const invalidUrls = [];

    const rl = readline.createInterface({
        input: fs.createReadStream(inputFile),
        output: process.stdout,
        terminal: false
    });

    for await (const line of rl) {
        const inputUrl = line.trim();
        const normalizedUrl = normalizeUrl(inputUrl);
        if (shouldIncludeUrl(normalizedUrl, excludedExtensions)) {
            urls.add(normalizedUrl);
        } else {
            invalidUrls.push(inputUrl);
        }
    }

    return { validUrls: urls, invalidUrls };
}

async function main() {
    const args = process.argv.slice(2);
    if (args.length < 4 || args[0] !== '-c' || args[2] !== '-o') {
        console.error('Usage: node remove-duplicates-verify-urls.js -c <inputCSVFile> -o <outputCSVFile>');
        process.exit(1);
    }

    const inputFile = args[1];
    const outputFile = args[3];

    const excludedExtensions = ['.asp', '.aspx', '.ashx', '.css', '.png', '.json', '.pdf', '.txt', '.js', '.php', '.svg', '.woff2', '.woff', '.ttf', '.eot', '.ico', '.esi', '.gif', '.jpg', '.html', '.rss', '.zip', '.doc', '.docx'];

    try {
        const { validUrls, invalidUrls } = await processUrls(inputFile, excludedExtensions);
        const finalUrls = new Set();

        for (const inputUrl of validUrls) {
            try {
                const result = await crawlUrl(inputUrl);
                finalUrls.add(result.resolvedUrl);
                if (result.isRedirected) {
                    console.log(`Redirected URL: Original: ${result.originalUrl}, Final: ${result.resolvedUrl}`);
                }
            } catch (error) {
                console.error(error.message);
            }
        }

        fs.writeFileSync(outputFile, [...finalUrls].join('\n'));
        console.log(`Output written to ${outputFile}`);

        if (invalidUrls.length > 0) {
            console.log('\nInvalid URLs:');
            invalidUrls.forEach((invalidUrl) => {
                console.log(invalidUrl);
            });
        }
    } catch (error) {
        console.error(error.message);
    }
}

main();
