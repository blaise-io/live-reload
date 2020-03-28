/**
 * Run the test server using `npm run test.page`.
 * Open test page using `npm run test.browser`.
 */

/* eslint-env node */

const express = require('express');
const app = express();

const frameUrl = '/pages/frame.html';
const scriptUrl = '/static/abc/def/script.js';
const styleUrl = '/static/abc/def/style.css';
const styleImportUrl = '/static/abc/def/import.css';
const baseStyle = `
    html, body {
        font: 18px/24px monospace;
        width: 400px;
        padding: 0;
        margin: 0 auto;
        overflow: hidden;
    }
    iframe {
        margin: 2em 0 -4px;
        height: 22px;
        width: 100%;
        border: none;
    }
    pre::before,
    pre::after {
        display: block;
    }
    div {
        margin-top: 3em;
    }
`;


function now() {
    return (new Date()).toLocaleTimeString('uk'); // hh:mm:ss
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
    res.send(`
        <!doctype html>
        <html>
            <meta charset="utf-8">
            <title>Live Reload test</title>
            <style>${baseStyle}</style>
            <link rel="stylesheet" href="${styleUrl}">
            <iframe src="${frameUrl}"></iframe>
            <pre id="js"></pre>
            <pre id="css"></pre>
            <div>Create a reload rule</div>
            <dl>
                <dt>Host URL</dt>
                <dd>http://${req.get('Host')}/*</dd>
                <dt>Source URLs</dt>
                <dd>http://${req.get('Host')}/*.js<br>
                    http://${req.get('Host')}/*.css<br>
                    http://${req.get('Host')}/*.html</dd>
            </dl>
            <button onclick="history.pushState(null, '', '/?' + Math.random().toString(36).substr(2))">Pushstate</button>
            <script src="${scriptUrl}"></script>
        </html>
    `);
});


app.get(frameUrl, function(req, res) {
    log(req);
    res.send(`
        <!doctype html>
        <html>
            <meta charset="utf-8">
            <style>${baseStyle}</style>
            &nbsp;Frame loaded at ${now()}
        </html>
    `);
});


app.get(scriptUrl, function(req, res) {
    log(req);
    res.contentType('application/javascript');
    res.send(`
        const pre = document.querySelector('pre#js');
        pre.textContent = "Script loaded at ${now()}";
    `);
});

app.get(styleUrl, function(req, res) {
    log(req);
    res.contentType('text/css');
    res.send(`
        @import "${styleImportUrl}";
        pre#css::before {
            content: " Style loaded at ${now()}"
        }
    `);
});

app.get(styleImportUrl, function(req, res) {
    log(req);
    res.contentType('text/css');
    res.send(`
        pre#css::after {
            content: "Import loaded at ${now()}"
        }
    `);
});

app.listen(3000);
