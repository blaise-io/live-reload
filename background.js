// TODO: UI for editing and deleting rules.
// TODO: Restart when rules change.
// TODO: Determine lifetime of a rule.
// TODO: Reload stylesheet, not page

const MATCH_PATTERN = (/^(?:(\*|https?|file|ftp|app):\/\/([^/]+|)\/?(.*))$/i);
const ALL_URLS = (/^(?:https?|file|ftp|app):\/\//);

const tabData = {};
const registry = {};
const rules = [];


// Fetch reload rules from storage.
browser.storage.sync.get('rules').then((result) => {
    updateReloadRules(result.rules);
}).catch((error) => {
    console.error('Error retrieving rules:', error);
});


// Whenever a page in a tab is done loading, check whether the page
// requires any source file monitoring.
browser.tabs.onUpdated.addListener((id, changeInfo, tab) => {
    if (tab.status === 'complete') {
        disableAllMonitoring(tab.id);
        rules.forEach((rule) => {
            // Host matches pattern, start monitoring.
            if (tab.url.match(rule.hostRegExp)) {
                const code = `(${inject.toSource()})("${rule.id}");`;
                browser.tabs.executeScript(tab.id, {code});
                // Flow continues at "pageSourceFiles" message listener.
            }
        });
    }
});

browser.tabs.onRemoved.addListener((tabId) => {
    disableAllMonitoring(tabId);
});


// Pick up on messages.
chrome.runtime.onMessage.addListener((message, sender) => {
    switch (message.type) {
        case 'updatedReloadRules':
            updateReloadRules(message.rules);
            break;
        case 'pageSourceFiles':
            // Retrieve rule again.
            rules.forEach((rule) => {
                if (message.rule === rule.id) {
                    checkSourceFileMatches(message, rule, sender.tab);
                }
            });
            break;
        case 'requestTabData':
            chrome.runtime.sendMessage({type: 'tabData', tabData});
            break;
    }
});


// Record tab when tab URL changes.
browser.tabs.onUpdated.addListener((id, changeInfo, tab) => {
    if (tab.status === 'complete') {
        recordTab(tab);
    }
});


// Record tab when active tab changes.
browser.tabs.onActivated.addListener((activeTab) => {
    browser.tabs.get(activeTab.tabId).then(recordTab);
});


function updateReloadRules(updateRules) {
    rules.length = 0;  // Truncate but keep reference.
    if (updateRules instanceof Array) {
        rules.push(...updateRules);
    }
    // Prepare regexps
    rules.forEach((rule) => {
        rule.hostRegExp = matchPatternAsRegExp(rule.host);
        rule.sourceRegExps = rule.sources.map((source) => {
            return matchPatternAsRegExp(source);
        });
    });
}


function checkSourceFileMatches(source, rule, tab) {
    const files = source.scripts.concat(source.styles);
    files.forEach((url) => {
        rule.sourceRegExps.forEach((regExp) => {
            if (url.match(regExp)) {
                const interval = rule.interval * 1000;  // s -> ms
                checkSourceFileChanged(tab, interval, regExp.source, url);
            }
        });
    });
}


// We record the last tab accessed to populate the add reload rule form.
function recordTab(tab) {
    if (!tab.incognito && tab.url.match(ALL_URLS)) {
        Object.assign(tabData, tab);
    }
}


function disableAllMonitoring(tabId) {
    Object.values(registry[tabId] || {}).forEach((fileRegistry) => {
        clearTimeout(fileRegistry.timer);
    });
}


function checkSourceFileChanged(tab, interval, sourceId, url) {
    registry[tab.id] = registry[tab.id] || {};
    const tabRegistry = registry[tab.id];

    if (!tabRegistry[sourceId]) {
        tabRegistry[sourceId] = {};
    }

    const fileRegistry = tabRegistry[sourceId];
    clearTimeout(fileRegistry.timer);

    getFileHash(url).then((hash) => {
        const oldHash = fileRegistry.hash;
        fileRegistry['hash'] = hash;
        if (!oldHash || oldHash === hash) {
            fileRegistry.timer = setTimeout(() => {
                checkSourceFileChanged(...arguments);
            }, interval);
        } else {
            browser.tabs.reload(tab.id);
        }
    }).catch((error) => {
        console.error(`Error retrieving hash for ${url}`, error);
        fileRegistry.timer = setTimeout(() => {
            checkSourceFileChanged(...arguments);
        }, interval);
    });
}


/**
 * Get file contents and hash it.
 */
function getFileHash(url) {
    return new Promise((resolve, reject) => {
        fetch(url, {cache: 'reload'})
            .then((response) => response.text())
            .then(sha1)
            .then(resolve)
            .catch(reject);
    });
}


/**
 * Sha1 hash of a string.
 */
function sha1(str) {
    const buffer = new TextEncoder('utf-8').encode(str);
    return crypto.subtle.digest('SHA-1', buffer).then(function(buffer) {
        const segments = [];
        const padding = '00000000';
        const view = new DataView(buffer);
        for (let i = 0; i < view.byteLength; i += 4) {
            const hexStr = view.getUint32(i).toString(16);
            const padStr = (padding + hexStr).slice(-padding.length);
            segments.push(padStr);
        }
        return segments.join('');
    });
}

function inject(rule) {
    const scriptElements = document.querySelectorAll('script[src]');
    const styleElements = document.querySelectorAll('link[rel]');

    chrome.runtime.sendMessage({
        type: 'pageSourceFiles',
        rule: rule,
        scripts: Array.from(scriptElements).map((el) => el.src),
        styles: Array.from(styleElements).map((el) => el.href),
    });
}


/**
 * https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Match_patterns
 * #Converting_Match_Patterns_to_Regular_Expressions
 */
function matchPatternAsRegExp(pattern) {
    if (pattern === '<all_urls>') {
        return ALL_URLS;
    }

    const match = MATCH_PATTERN.exec(pattern);

    if (match === null) {
        console.error(`Invalid match pattern: ${pattern}`);
        return (/^$/);
    }

    let [, scheme, host, path] = match;

    if (scheme === '*') {
        scheme = 'https?';
    } else {
        scheme = escape(scheme);
    }

    if (host === '*') {
        host = '[^\\/]*';
    } else {
        host = escape(host)
            .replace('%3A', ':')
            .replace(/^\*\./g, '(?:[^\\/]+)?');
    }

    if (path === '*') {
        path = '(?:\\/.*)?';
    } else if (path) {
        path = `\\/${escape(path).replace(/\*/g, '.*')}`;
    } else {
        path = '\\/?';
    }

    return new RegExp(`^(?:${scheme}://${host}${path})$`);
}
