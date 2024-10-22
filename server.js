const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const hostname = '127.0.0.1';
const port = 3000;

const publicDir = path.join(__dirname, 'public');

const server = http.createServer((req, res) => {
    if (req.url.startsWith('/api/worldbank/')) {
        const [countryCode, indicator] = req.url.split('/api/worldbank/')[1].split('/');
        proxyRequest(`https://api.worldbank.org/v2/country/${countryCode}/indicator/${indicator}?format=json&date=2020`, res);
    } else {
        let filePath = path.join(publicDir, req.url === '/' ? 'index.html' : req.url.split('?')[0]);

        console.log('Serving file from path:', filePath); // Debugging log

        if (!filePath.startsWith(publicDir)) {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('Access Denied');
            return;
        }

        const extname = String(path.extname(filePath)).toLowerCase();
        const mimeTypes = {
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpg',
            '.wav': 'audio/wav',
            '.mp4': 'video/mp4',
            '.woff': 'application/font-woff',
            '.ttf': 'application/font-ttf',
            '.eot': 'application/vnd.ms-fontobject',
            '.otf': 'application/font-otf',
            '.svg': 'application/image/svg+xml',
        };

        const contentType = mimeTypes[extname] || 'application/octet-stream';

        fs.readFile(filePath, (error, content) => {
            if (error) {
                if (error.code === 'ENOENT') {
                    res.writeHead(404, { 'Content-Type': 'text/html' });
                    res.end('<h1>404 Not Found</h1>', 'utf-8');
                } else {
                    res.writeHead(500);
                    res.end(`Server Error: ${error.code}`);
                }
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content, 'utf-8');
            }
        });
    }
});

function proxyRequest(apiUrl, res) {
    const urlObj = new URL(apiUrl);
    const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
    };

    const proxy = https.request(options, function (apiRes) {
        let data = '';

        apiRes.on('data', function (chunk) {
            data += chunk;
        });

        apiRes.on('end', function () {
            res.writeHead(apiRes.statusCode, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            });
            res.end(data);
        });
    });

    proxy.on('error', function (err) {
        console.error('Error fetching data from API:', err);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server Error');
    });

    proxy.end();
}
async function calculateCountryDataOperation(countryName, dataItem1, dataItem2, operation) {
    var countryCode = countryCodeMap[countryName];
    var indicator1 = getIndicatorCode(dataItem1);
    var indicator2 = getIndicatorCode(dataItem2);

    var value1 = await getWorldBankData(countryCode, indicator1);
    var value2 = await getWorldBankData(countryCode, indicator2);

    if (value1 == null || value2 == null) {
        alert('Data not available for selected items.');
        return;
    }

    var result = null;
    switch (operation) {
        case 'add':
            result = value1 + value2;
            break;
        case 'subtract':
            result = value1 - value2;
            break;
        case 'multiply':
            result = value1 * value2;
            break;
        case 'divide':
            result = value2 !== 0 ? value1 / value2 : null;
            break;
    }

    // Display the result
    var resultText = `
        <b>${countryName}:</b><br>
        ${dataItem1} ${getOperationSymbol(operation)} ${dataItem2} = ${formatNumber(result)}
    `;

    L.popup()
        .setLatLng(map.getCenter())
        .setContent(resultText)
        .openOn(map);
}

server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});
