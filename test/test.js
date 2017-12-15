/**
 * Run the test server using `npm start`.
 * Open test page using `npm run browser`.
 */

/* eslint-env node */

const express = require('express');
const app = express();

const frameUrl = '/pages/frame.html';
const scriptUrl = '/static/abc/def/script.js';
const styleUrl = '/static/abc/def/style.css';
const baseStyle = `
    body { 
        font: 18px/24px monospace; 
        width: 400px; 
        padding: 0; 
        margin: 0 auto; 
    }
    iframe { 
        margin: 5em 0 0; 
        height: 18px; 
        width: 100%; 
        border: none; 
    }
    pre { 
        min-height: 5em; 
        margin: 0 0 2em; 
    }
    pre::after { 
        display: block; 
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
            <pre></pre>
            <div>Create a reload rule</div>
            <dl>
                <dt>Host URL</dt>
                <dd>http://${req.get('Host')}/*</dd>
                <dt>Source URLs</dt>
                <dd>http://${req.get('Host')}/*.js<br>
                    http://${req.get('Host')}/*.css<br>
                    http://${req.get('Host')}/*.html</dd>
            </dl>
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
