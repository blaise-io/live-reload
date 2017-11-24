// When enabled, files will be monitored,
// when disabled rules can still be managed.
let addonEnabled = true;

const tabData = {};
const registry = {};
const rules = [];


// Fetch reload rules from storage.
getListRules().then(updateReloadRules);


// Fetch active state.
browser.storage.local.get('addonEnabled').then((result) => {
    toggleAddonEnabled(result.addonEnabled !== false)
});


// Whenever a page in a tab is done loading, check whether the page
// requires any source file monitoring.
browser.tabs.onUpdated.addListener((id, changeInfo, tab) => {
    if (addonEnabled && tab.status === 'complete') {
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
chrome.runtime.onMessage.addListener((message, sender) => {
    switch (message.type) {
        case 'requestAddonEnabled':
            chrome.runtime.sendMessage({type: 'addonEnabled', addonEnabled});
            break;
        case 'addonEnabledChanged':
            toggleAddonEnabled(message.addonEnabled);
            break;
        case 'reloadRulesChanged':
            updateReloadRules(message.rules);
            break;
        case 'pageSourceFiles':
            // Retrieve rule again.
            const rule = rules.find((rule) => rule.id === message.rule);
            if (rule) {
                checkSourceFileMatches(
                    message.scripts.concat(message.styles), rule, sender.tab
                );
            }
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


// Toggle icon and title when monitoring is enable/disabled.
function toggleAddonEnabled(enabled) {
    addonEnabled = enabled;
    let action = {};
    if (enabled) {
        continueMonitoring();
        action.icon = "/icons/icon.svg";
        action.title = "Live Reload";
    } else {
        disableAllMonitoring();
        action.icon = "icons/icon-disabled.svg";
        action.title = "Live Reload (disabled)";
    }
    browser.browserAction.setIcon({path: action.icon});
    browser.browserAction.setTitle({title: action.title});
}


function monitorTabIfEligible(tab) {
    rules.forEach((rule) => {
        // Host matches pattern, start monitoring.
        if (tab.url.match(rule.hostRegExp)) {
            const code = `(${inject.toSource()})("${rule.id}");`;
            browser.tabs.executeScript(tab.id, {code});
            // Flow continues at case "pageSourceFiles".
        }
    });
}


function inject(rule) {
    const scriptElements = document.querySelectorAll('script[src]');
    const styleElements = document.querySelectorAll('link[rel=stylesheet]');

    chrome.runtime.sendMessage({
        type: 'pageSourceFiles',
        rule: rule,
        scripts: Array.from(scriptElements).map((el) => el.src),
        styles: Array.from(styleElements).map((el) => el.href),
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

    // Restart.
    disableAllMonitoring();
    continueMonitoring();
}


function checkSourceFileMatches(files, rule, tab) {
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
    });
}


async function continueMonitoring() {
    const tabs = await browser.tabs.query({status: 'complete'});
    tabs.forEach((tab) => {
        monitorTabIfEligible(tab);
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
    const padZeroes = '00000000';
    const dataView = new DataView(sha1Buffer);
    let sha1 = '';
    for (let i = 0; i < dataView.byteLength; i += 4) {
        const hexString = dataView.getUint32(i).toString(16);
        sha1 += (padZeroes + hexString).slice(-padZeroes.length);
    }
    return sha1;
}
