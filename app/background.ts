import * as iconDisabled from "./icons/icon-disabled.png";
import * as icon from "./icons/icon.png";
import * as inject from "./inject";
import { sourceHost } from "./lib/match-pattern";
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

// Whenever a user navigates to a new page in the top-level frame, we restart monitoring.
browser.webNavigation.onBeforeNavigate.addListener(async (details) => {
    if (isMonitoring && details.frameId === 0) {
        console.log(details.tabId, "Navigated to new URL:", details.url);
        await disableTabMonitoring(details.tabId);
        await monitorTabIfRuleMatch(details.tabId, details.url);
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

async function monitorTabIfRuleMatch(tabId: number, tabUrl: string) {
    for (const rule of rules) {
        // Host matches pattern, start monitoring.
        if (tabId && tabUrl && tabUrl.match(rule.hostRegExp)) {
            console.info(tabId, tabUrl, "matches rule", rule.title);

            await removeWebRequestsForTabId(tabId);

            // Match all paths of all hosts in rules.sources,
            // strict filtering in webRequestHeadersReceived:
            const urls = rule.sources.map((source) => sourceHost(source))

            const filter: browser.webRequest.RequestFilter = {
                tabId: tabId,
                types: ["script", "stylesheet", "sub_frame"],
                urls: urls,
            };

            console.debug(tabId, tabUrl, "initialize monitoring");
            const boundListener = webRequestHeadersReceived.bind(null, tabId, rule);

            browser.webRequest.onHeadersReceived.addListener(boundListener, filter);
            boundListener({url: tabUrl, type: "main_frame"})  // manual trigger to avoid race condition
            webRequestListeners[tabId] = boundListener;
        }
    }
}

async function webRequestHeadersReceived(tabId: number, rule: Rule, sourceDetails: WebrequestDetails) {
    const url = stripNoCacheParam(sourceDetails.url);
    if (
        anyRegexMatch(rule.sourceRegExps, url)
    ) {
        if (anyRegexMatch(rule.ignoresRegExps, url)) {
            console.debug("IGNORE", url);
        } else {
            console.info("MATCH", url);
            await checkSourceFileChanged(tabId, rule, sourceDetails);
        }
    } else {
        console.debug("SKIP", url);
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
    if (rules.length) {
        console.debug("Enable monitoring with reload rules", rules);
        const tabs = await browser.tabs.query({status: "complete", windowType: "normal"});
        tabs.forEach((tab) => {
            if (tab.id && tab.url) {
                monitorTabIfRuleMatch(tab.id, tab.url)
            }
        });
    } else {
        console.debug("No reload rules, no monitoring");
    }
}

async function disableAllMonitoring() {
    console.debug("Disable monitoring for all tabs");
    Object.keys(registry).forEach((tabId) => {
        disableTabMonitoring(Number(tabId));
    });
}

async function disableTabMonitoring(tabId: number) {
    console.debug(tabId, "disable tab monitoring");
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
    try {
        if (options["show.badge"] && isMonitoring && count !== null) {
            await browser.browserAction.setBadgeBackgroundColor({color: "black"});
            await browser.browserAction.setBadgeText({text: count.toString(), tabId});
        } else {
            await browser.browserAction.setBadgeText({text: "", tabId});
        }
    } catch (err) {
        return  // Tab closed
    }
}

async function checkSourceFileChanged(
    tabId: number,
    rule: Rule,
    sourceDetails: WebrequestDetails,
) {
    let hash;
    const url = sourceDetails.url as string;
    const noCacheUrl = stripNoCacheParam(url);

    if (!isMonitoring) {
        return;
    }

    const tabRegistry = registry[tabId] = registry[tabId] || {};
    const fileRegistry = tabRegistry[noCacheUrl] = tabRegistry[noCacheUrl] || {hash: null, timer: null};

    try {
        hash = await getFileHash(url);
    } catch (error) {
        console.error(noCacheUrl, "Error retrieving hash:", error);
    }

    await setBadge(tabId, Object.keys(tabRegistry).length);

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
            await browser.tabs.executeScript(tabId, {code});
        } else {
            console.info(noCacheUrl, "reload parent page");
            await disableTabMonitoring(tabId);
            await browser.tabs.reload(tabId, {bypassCache: true});
        }
    } else {
        // Not changed or old/new hash cannot be retrieved, retry later:
        console.debug(noCacheUrl, "not changed");
        clearTimeout(fileRegistry.timer);
        fileRegistry.hash = hash || fileRegistry.hash;
        fileRegistry.timer = window.setTimeout(() => {
            checkSourceFileChanged(tabId, rule, sourceDetails);
        }, rule.intervalMs);
    }
}
