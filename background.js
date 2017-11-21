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


async function checkSourceFileChanged(tab, interval, sourceId, url) {
    let hash;
    const tabRegistry = registry[tab.id] = registry[tab.id] || {};
    const fileRegistry = tabRegistry[sourceId] = tabRegistry[sourceId] || {};

    try {
        hash = await getFileHash(url);
    } catch (error) {
        console.error(`Error retrieving hash for ${url}`, error);
    }

    // Check whether the source file hash has changed.
    if (hash && fileRegistry.hash && fileRegistry.hash !== hash) {
        // Changed: reload tab.
        browser.tabs.reload(tab.id);
    } else {
        // Not changed or old/new hash cannot be retrieved:
        // Retry later.
        clearTimeout(fileRegistry.timer);
        fileRegistry.timer = setTimeout(() => {
            checkSourceFileChanged(...arguments);
        }, interval);
    }

    // Update registry with latest hash.
    fileRegistry.hash = hash || fileRegistry.hash;
}


/**
 * Get file contents and hash it.
 */
async function getFileHash(url) {
    const response = await fetch(url, {cache: 'reload'});
    const text = await response.text();
    return await sha1(text);
}


/**
 * Sha1 hash of a string.
 */
async function sha1(str) {
    const encodedText = new TextEncoder('utf-8').encode(str);
    const sha1Buffer = await crypto.subtle.digest('SHA-1', encodedText);
    const segments = '';
    const padZeroes = '00000000';
    const dataView = new DataView(sha1Buffer);
    for (let i = 0; i < dataView.byteLength; i += 4) {
        const hexString = dataView.getUint32(i).toString(16);
        segments += (padZeroes + hexString).slice(-padZeroes.length);
    }
    return segments;
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
