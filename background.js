// TODO: UI for rules.
// TODO: Restart when rules changes.
// TODO: Determine lifetime of a rule.
// TODO: Retrieve from and store rules in storage.sync
// TODO: Reload stylesheet, not page

const rules = [
  {
    'id': 'id1',
    'host': {
        'regexp': {
            'pattern': '.*:8000\\/dashboard',
            'flags': 'i',
        },
    },
    'files': [
      {
        'id': 'id2',
        'regexp': {
          'pattern': 'reporting_dashboard\\/app\\.js',
          'flags': 'i',
        },
        'reload': {
          'interval': 2000,
        },
      },
    ],
  },
];


const tabData = {};
const registry = {};


// Prepare regexps
rules.forEach((rule) => {
    const hostRegexp = rule.host.regexp;
    rule.hostRegexp = new RegExp(hostRegexp.pattern, hostRegexp.flags);
    rule.files.forEach((file) => {
        file.fileRegexp = new RegExp(file.regexp.pattern, file.regexp.flags);
    });
});

// Monitor tab for rule host matches.
browser.tabs.onUpdated.addListener((id, changeInfo, tab) => {
    const file = 'inject.js';
    if (tab.status === 'complete') {
        rules.forEach((rule) => {
            if (tab.url.match(rule.hostRegexp)) {
                registry[tab.id] = registry[tab.id] || {};
                browser.tabs.executeScript(tab.id, {file});
            }
        });
    } else {
        // TODO: Kill all existing monitoring for this tab.
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


// Listen to page reports.
chrome.runtime.onMessage.addListener((message, sender) => {
    // Find rule again.
    switch (message.type) {

        case 'requestTabData':
            chrome.runtime.sendMessage({type: 'tabData', tabData});
            break;

        case 'pageSourceFiles':
            rules.forEach((rule) => {
                if (sender.tab.url.match(rule.hostRegexp)) {
                    message.scripts.concat(message.styles).forEach((url) => {
                        rule.files.forEach((file) => {
                            if (url.match(file.fileRegexp)) {
                                checkFileChanged(sender.tab, file, url);
                            }
                        });
                    });
                }
            });
            break;
    }
});


// Record last tab so we can pre-populate the add reload rule form.
function recordTab(tab) {
    if (!tab.incognito && tab.url.match(/^(https?|file|ftp|app)/)) {
        Object.assign(tabData, tab);
    }
}


function checkFileChanged(tab, file, url) {
    const tabRegistry = registry[tab.id];

    if (!tabRegistry[file.id]) {
        tabRegistry[file.id] = {};
    }

    const fileRegistry = tabRegistry[file.id];
    clearTimeout(fileRegistry.timer)

    getFileHash(url).then((hash) => {
        const oldHash = fileRegistry.hash;
        fileRegistry['hash'] = hash;
        if (!oldHash || oldHash === hash) {
            fileRegistry.timer = setTimeout(() => {
                checkFileChanged(tab, file, url);
            }, file.reload.interval);
        } else {
            browser.tabs.reload(tab.id);
        }
    }).catch((error) => {
        console.error(`Error retrieving hash for ${url}`, error);  // eslint-disable-line
        fileRegistry.timer = setTimeout(() => {
            checkFileChanged(tab, file, url);
        }, file.reload.interval);
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
