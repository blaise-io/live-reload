// When enabled, files will be monitored,
// when disabled rules can still be managed.
let isMonitoring = true;

const tabData = {};
const registry = {};
const options = {};
const rules = [];


// Fetch options and rules.
Promise.all([
    fetch('../options/defaults.json').then((response) => response.json()),
    browser.storage.local.get('options'),
    getListRules(),
]).then((result) => {
    Object.assign(options, result[0], result[1].options);
    updateReloadRules(result[2]);
});


// Fetch active state.
browser.storage.local.get('isMonitoring').then((result) => {
    toggleAddonEnabled(result.isMonitoring !== false);
});


// Whenever a page in a tab is done loading, check whether the page
// requires any source file monitoring.
browser.tabs.onUpdated.addListener((id, changeInfo, tab) => {
    if (isMonitoring && tab.status === 'complete') {
        disableTabMonitoring(tab.id);
        monitorTabIfEligible(tab);
    }
});


// Stop monitoring and delete from registry  when a tab closes.
browser.tabs.onRemoved.addListener((tabId) => {
    disableTabMonitoring(tabId);
    delete(registry[tabId]);
});


// Pick up on messages.
browser.runtime.onMessage.addListener((message, sender) => {
    switch (message.type) {
        case 'isMonitoring?':
            browser.runtime.sendMessage({type: 'isMonitoring', isMonitoring});
            break;
        case 'tabData?':
            browser.runtime.sendMessage({type: 'tabData', tabData});
            break;
        case 'monitoringChange':
            toggleAddonEnabled(message.isMonitoring);
            break;
        case 'reloadRulesChange':
            updateReloadRules(message.rules);
            break;
        case 'optionsChange':
            Object.assign(options, message.options);
            break;
        case 'pageSourceFiles':
            pageSourceFilesReceived(message.files, message.rule, sender.tab);
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


// Toggle icon and title when monitoring is enable/disabled.
function toggleAddonEnabled(enabled) {
    isMonitoring = enabled;
    let action = {};
    if (enabled) {
        continueMonitoring();
        action.icon = '/icons/icon.svg';
        action.title = 'Live Reload';
    } else {
        disableAllMonitoring();
        action.icon = 'icons/icon-disabled.svg';
        action.title = 'Live Reload (disabled)';
    }
    browser.browserAction.setIcon({path: action.icon});
    browser.browserAction.setTitle({title: action.title});
}


function monitorTabIfEligible(tab) {
    rules.forEach((rule) => {
        // Host matches pattern, start monitoring.
        if (tab.url.match(rule.hostRegExp)) {
            const code = `(${injectSendSourceFiles.toSource()})("${rule.id}");`;
            browser.tabs.executeScript(tab.id, {code});
            // Flow continues at case "pageSourceFiles".
        }
    });
}


function injectSendSourceFiles(rule) {
    const scriptElements = document.querySelectorAll('script[src]');
    const styleElements = document.querySelectorAll('link[rel=stylesheet]');
    const files = {
        css: Array.from(styleElements).map((el) => el.href),
        js: Array.from(scriptElements).map((el) => el.src),
    };
    browser.runtime.sendMessage({type: 'pageSourceFiles', rule, files});
}


function injectUpdateUrl(url, updateUrl) {
    const styleElements = document.querySelectorAll('link[rel=stylesheet]');
    Array.from(styleElements).forEach((el) => {
        if (el.href === url) {
            el.href = updateUrl;
        }
    });
}


function updateReloadRules(updateRules) {
    rules.length = 0;  // Truncate, but keep reference.
    if (updateRules instanceof Array) {
        rules.push(...updateRules);
    }

    // Prepare regexps.
    rules.forEach((rule) => {
        rule.hostRegExp = getRegExpForMatchPattern(rule.host);
        rule.sourceRegExps = rule.sources.map((source) => {
            return getRegExpForMatchPattern(source);
        });
    });

    restart();
}


// Restart.
function restart() {
    disableAllMonitoring();
    continueMonitoring();
}


function pageSourceFilesReceived(files, ruleId, tab) {
    const rule = rules.find((rule) => rule.id === ruleId);
    if (rule) {
        checkSourceFileMatches(files, rule, tab);
    }
}


function checkSourceFileMatches(files, rule, tab) {
    Object.entries(files).forEach(([type, filesOfType]) => {
        filesOfType.forEach((url) => {
            rule.sourceRegExps.forEach((regExp) => {
                if (url.match(regExp)) {
                    checkSourceFileChanged(tab, rule, url, type);
                }
            });
        });
    });
}


// Record the last tab so we're able to populate the add reload rule form.
function recordTab(tab) {
    if (!tab.incognito && tab.url.match(allUrlsRegExp)) {
        Object.assign(tabData, tab);
    }
}


function disableAllMonitoring() {
    Object.keys(registry).forEach((tabId) => {
        disableTabMonitoring(tabId);
    });
}


function disableTabMonitoring(tabId) {
    Object.values(registry[tabId] || {}).forEach((fileRegistry) => {
        clearTimeout(fileRegistry.timer);
        delete(registry[tabId]);
    });
}


async function continueMonitoring() {
    const tabs = await browser.tabs.query({status: 'complete'});
    tabs.forEach((tab) => {
        monitorTabIfEligible(tab);
    });
}


async function checkSourceFileChanged(tab, rule, url, type) {
    let hash;
    const tabRegistry = registry[tab.id] = registry[tab.id] || {};
    const fileRegistry = tabRegistry[url] = tabRegistry[url] || {};

    try {
        hash = await getFileHash(url);
    } catch (error) {
        console.error(url, 'Error retrieving hash:', error);
    }

    if (options['show.badge']) {
        const count = Object.keys(tabRegistry).length.toString();
        browser.browserAction.setBadgeBackgroundColor({color: 'black'});
        browser.browserAction.setBadgeText({text: count, tabId: tab.id});
    } else {
        browser.browserAction.setBadgeText({text: '', tabId: tab.id});
    }

    // Check whether the source file hash has changed.
    if (hash && fileRegistry.hash && fileRegistry.hash !== hash) {
        if (type === 'css' && rule.inlinecss) {
            // Inline reload:
            delete(tabRegistry[url]);
            const source = injectUpdateUrl.toSource();
            const noCacheUrl = getNoCacheURL(url);
            const code = `(${source})("${url}", "${noCacheUrl}");`;
            browser.tabs.executeScript(tab.id, {code});
            checkSourceFileChanged(tab, rule, noCacheUrl, type);
        } else {
            // Page reload:
            browser.tabs.reload(tab.id);
            disableTabMonitoring(tab.id);
        }
    } else {
        // Not changed or old/new hash cannot be retrieved, retry later:
        clearTimeout(fileRegistry.timer);
        fileRegistry.hash = hash || fileRegistry.hash;
        fileRegistry.timer = setTimeout(() => {
            checkSourceFileChanged(...arguments);
        }, rule.interval * 1000);
    }
}


// Append a unique string to a URL to avoid cache.
function getNoCacheURL(url) {
    const urlObj = new URL(url);
    const timeHash = new Date().getTime().toString(36).substr(3);
    urlObj.searchParams.set('X-LR-NOCACHE', timeHash);
    return urlObj.href;
}


// Get file contents and hash it.
async function getFileHash(url) {
    const response = await fetch(url, {cache: 'reload'});
    const text = await response.text();
    return await sha1(text);
}


// Retrieve the SHA1 hash for a string.
async function sha1(str) {
    const encodedText = new TextEncoder('utf-8').encode(str);
    const sha1Buffer = await crypto.subtle.digest('SHA-1', encodedText);
    const padZeroes = '00000000';
    const dataView = new DataView(sha1Buffer);
    let sha1 = '';
    for (let i = 0; i < dataView.byteLength; i += 4) {
        const hexString = dataView.getUint32(i).toString(16);
        sha1 += (padZeroes + hexString).slice(-padZeroes.length);
    }
    return sha1;
}
