import * as iconDisabled from "./icons/icon-disabled.png";
import * as icon from "./icons/icon.png";
import * as inject from "./inject";
import * as matchPattern from "./lib/match-pattern";
import { Rule } from "./lib/rule";
import { defaults, UserOptions } from "./options/defaults";
import { anyRegexMatch, getFileHash, stripNoCacheParam } from "./util";

let isMonitoring: boolean = true;

const tabData = {};
const registry: Record<number, TabRegistry> = {};
const options: UserOptions = {};
const rules: Rule[] = [];
const webRequestListeners: Record<number, () => void> = {};

(async () => {
    const optionsResult = await browser.storage.local.get("options");
    const userOptions = "options" in optionsResult ? optionsResult.options : {};
    Object.assign(options, defaults, userOptions);
    await updateRulesFromStorage();
})();

// Fetch active state.
browser.storage.local.get("isMonitoring").then(async (result) => {
    await toggleAddonEnabled(!("isMonitoring" in result) || result.isMonitoring);
});

// Whenever a page in a tab is done loading, check whether the page
// requires any source file monitoring.
browser.tabs.onUpdated.addListener(async (_, __, tab) => {
    if (isMonitoring && tab.status === "loading" && tab.id) {
        await disableTabMonitoring(tab.id);
        await monitorTabIfRuleMatch(tab);
    }
});

// Stop monitoring and delete from registry  when a tab closes.
browser.tabs.onRemoved.addListener(async (tabId) => {
    await disableTabMonitoring(tabId);
});

// Pick up on messages.
browser.runtime.onMessage.addListener(async (message, sender) => {
    console.info("Incoming message from ", sender.url, message);
    switch (message.type) {
        case "isMonitoring?":
            await browser.runtime.sendMessage({type: "isMonitoring", isMonitoring});
            break;
        case "tabData?":
            await browser.runtime.sendMessage({type: "tabData", tabData});
            break;
        case "monitoringChange":
            await toggleAddonEnabled(message.isMonitoring);
            break;
        case "reloadRulesChange":
            await updateRulesFromStorage();
            break;
        case "optionsChange":
            Object.assign(options, message.options);
            break;
    }
});

// Record tab when tab URL changes.
browser.tabs.onUpdated.addListener((_, __, tab) => {
    if (tab.status === "complete") {
        recordTab(tab);
    }
});

// Record tab when active tab changes.
browser.tabs.onActivated.addListener((activeTab) => {
    browser.tabs.get(activeTab.tabId).then(recordTab);
});

// Toggle icon and title when monitoring is enable/disabled.
async function toggleAddonEnabled(enabled: boolean) {
    isMonitoring = enabled;
    let iconPath: string;
    let title: string;
    if (enabled) {
        await enableMonitoring();
        iconPath = icon;
        title = "Live Reload";
    } else {
        await disableAllMonitoring();
        iconPath = iconDisabled;
        title = "Live Reload (disabled)";
    }
    await browser.browserAction.setIcon({path: iconPath});
    await browser.browserAction.setTitle({title});
}

async function monitorTabIfRuleMatch(tab: browser.tabs.Tab) {
    for (const rule of rules) {
        // Host matches pattern, start monitoring.
        if (tab.id && tab.url && tab.url.match(rule.hostRegExp)) {
            console.info(tab.id, tab.url, "matches rule", rule.title);

            await removeWebRequestsForTabId(tab.id);

            const boundListener = webRequestHeadersReceived.bind(null, tab, rule);
            const filter: browser.webRequest.RequestFilter = {
                tabId: tab.id,
                types: ["script", "stylesheet", "sub_frame"],
                // Cannot use rule.sources, does not match port.
                // https://bugzilla.mozilla.org/show_bug.cgi?id=1362809
                urls: ["<all_urls>"],
            };

            console.debug(tab.id, tab.url, "initialize monitoring");
            browser.webRequest.onHeadersReceived.addListener(boundListener, filter);
            webRequestListeners[tab.id] = boundListener;
        }
    }
}

async function webRequestHeadersReceived(tab: browser.tabs.Tab, rule: Rule, sourceDetails: WebrequestDetails) {
    const url = stripNoCacheParam(sourceDetails.url);
    if (
        anyRegexMatch(rule.sourceRegExps, url)
    ) {
        if (anyRegexMatch(rule.ignoresRegExps, url)) {
            console.debug(url, "IGNORE");
        } else {
            console.info(url, "MATCHED");
            await checkSourceFileChanged(tab, rule, sourceDetails);
        }
    } else {
        console.debug(url, "SKIP");
    }
}

async function updateRulesFromStorage() {
    console.debug("Update rules from storage");
    const storageRules = await Rule.query();
    rules.length = 0;  // Truncate, but keep reference.
    rules.push(...storageRules);
    await restart();
}

async function restart() {
    await disableAllMonitoring();
    await enableMonitoring();
}

async function enableMonitoring() {
    console.debug("Enable monitoring");
    const tabs = await browser.tabs.query({status: "complete", windowType: "normal"});
    tabs.forEach(monitorTabIfRuleMatch);
}

async function disableAllMonitoring() {
    console.debug("Disable monitoring for all tabs");
    Object.keys(registry).forEach((tabId) => {
        disableTabMonitoring(Number(tabId));
    });
}

async function disableTabMonitoring(tabId: number) {
    await removeWebRequestsForTabId(tabId);
    Object.entries(registry[tabId] || {}).forEach(([fileName, fileRegistry]) => {
        console.debug(tabId, fileName, "stop file monitoring timer");
        clearTimeout(fileRegistry.timer);
    });
    delete registry[tabId];
    await setBadge(Number(tabId), null);
}

// Record the last tab so we're able to populate the add reload rule form.
function recordTab(tab: browser.tabs.Tab) {
    if (!tab.incognito && tab.url && tab.url.match(matchPattern.ALL_URLS_RE)) {
        Object.assign(tabData, tab);
    }
}

async function removeWebRequestsForTabId(tabId: number) {
    if (webRequestListeners[tabId]) {
        console.debug(tabId, "remove webrequests listener");
        await browser.webRequest.onHeadersReceived.removeListener(webRequestListeners[tabId]);
        delete webRequestListeners[tabId];
    }
}

async function setBadge(tabId: number, count: number | null) {
    if (options["show.badge"] && isMonitoring && count !== null) {
        await browser.browserAction.setBadgeBackgroundColor({color: "black"});
        await browser.browserAction.setBadgeText({text: count.toString(), tabId});
    } else {
        await browser.browserAction.setBadgeText({text: "", tabId});
    }
}

async function checkSourceFileChanged(
    tab: browser.tabs.Tab,
    rule: Rule,
    sourceDetails: WebrequestDetails,
) {
    let hash;
    const url = sourceDetails.url as string;
    const noCacheUrl = stripNoCacheParam(url);

    if (!isMonitoring) {
        return;
    }

    tab.id = tab.id || 0;
    const tabRegistry = registry[tab.id] = registry[tab.id] || {};
    const fileRegistry = tabRegistry[noCacheUrl] = tabRegistry[noCacheUrl] || {timer: null};

    try {
        hash = await getFileHash(url);
    } catch (error) {
        console.error(noCacheUrl, "Error retrieving hash:", error);
    }

    await setBadge(tab.id, Object.keys(tabRegistry).length);

    // Check whether the source file hash has changed.
    if (hash && fileRegistry.hash && fileRegistry.hash !== hash) {
        console.info(noCacheUrl, "change detected");
        if (
            (sourceDetails.type === "stylesheet" && rule.inlinecss) ||
            (sourceDetails.type === "sub_frame" && rule.inlineframes)
        ) {
            console.info(noCacheUrl, "inline reload");
            delete tabRegistry[noCacheUrl];
            const source = inject.inlineReload.toString();
            const code = `(${source})("${sourceDetails.type}", "${url}");`;
            await browser.tabs.executeScript(tab.id, {code});
        } else {
            console.info(noCacheUrl, "reload parent page");
            await disableTabMonitoring(tab.id);
            await browser.tabs.reload(tab.id, {bypassCache: true});
        }
    } else {
        // Not changed or old/new hash cannot be retrieved, retry later:
        console.debug(noCacheUrl, "not changed");
        clearTimeout(fileRegistry.timer);
        fileRegistry.hash = hash || fileRegistry.hash;
        fileRegistry.timer = window.setTimeout(() => {
            checkSourceFileChanged(tab, rule, sourceDetails);
        }, rule.intervalMs);
    }
}
