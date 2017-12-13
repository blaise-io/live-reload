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
            <meta charset="utf-8">
            <title>Live Reload test</title>
            <style>
                body { font: 18px monospace; width: 400px; margin: 30px auto }
                pre { min-height: 5em }
                pre::after { display: block }
            </style>
            <link rel="stylesheet" href="${styleUrl}">
            <pre></pre>
            <div>Create a reload rule</div>
            <dl>
                <dt>Host URL</dt>
                <dd>http://${req.get('Host')}/*</dd>
                <dt>Source URLs</dt>
                <dd>http://${req.get('Host')}/*.js<br>
                    http://${req.get('Host')}/*.css</dd>
            </dl>
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
        pre::after {
            content: " Style loaded at ${now()}"
        }
    `);
});

app.listen(3000);
