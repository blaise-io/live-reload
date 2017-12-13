/**
 * Run using `npm start`.
 * Then run `npm run browser`
 */

/* eslint-env node */

const express = require('express');
const app = express();

const scriptUrl = '/static/abc/def/script.js';
const styleUrl = '/static/abc/def/style.css';

function now() {
    return (new Date()).toISOString().split(/[T.]/)[1];
}

function log(req) {
    let info = '';
    if (req.get('origin') && req.get('origin').startsWith('moz-extension')) {
        info = '*';
    }
    console.info(now(), req.url, info);
}

app.get('/', function(req, res) {
    log(req);
    const indexHtml = `
        <!doctype html>
        <html>
            <title>Live Reload test</title>
            <pre></pre>
            <div>Create a reload rule</div>
            <dl>
                <dt>Host URL</dt>
                <dd>http://${req.hostname}/*</dd>
                <dt>Source URLs</dt>
                <dd>http://${req.hostname}/*.js<br>
                    http://${req.hostname}/*.css</dd>
            </dl>
            <link rel="stylesheet" href="${styleUrl}">
            <script src="${scriptUrl}"></script>
        </html>
    `;
    res.send(indexHtml);
});

app.get(scriptUrl, function(req, res) {
    log(req);
    res.contentType('text/script');
    res.send(`
        const pre = document.querySelector('pre');
        pre.textContent = "Script loaded at ${now()}";
    `);
});

app.get(styleUrl, function(req, res) {
    log(req);
    res.contentType('text/css');
    res.send(`
        body { font: 14px monospace }
        pre { font-size: 30px }
        pre::after {
            display: block;
            content: " Style loaded at ${now()}"
        }
    `);
});

app.listen(3000);
