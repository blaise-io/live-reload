import * as iconDisabled from "./icons/icon-disabled.svg";  // TODO: Render as PNG for non-Fx
import * as icon from "./icons/icon.png";
import { allUrlsRegExp } from "./lib/match-pattern";
import { Rule } from "./lib/rule";
import { defaults } from "./options/defaults";

let isMonitoring: boolean = true;

const nocacheParam = "X-LR-NOCACHE";

interface IFileProperties {
    timer?: number;
    hash?: string;
}

interface IFileRecord extends Record<string, IFileProperties> {
}

const tabData = {};
const registry: Record<number, IFileRecord> = {};
const options = {};
const rules: Rule[] = [];

enum SourceType {
    HOST = "host",
    CSS = "css",
    JS = "js",
    FRAME = "frame",
}

main();

async function main() {
    const optionsResult = await browser.storage.local.get("options");
    const userOptions = "options" in optionsResult ? optionsResult.options : {};
    Object.assign(options, defaults, userOptions);
    updateRulesFromStorage();
}

// Fetch active state.
browser.storage.local.get("isMonitoring").then((result) => {
    toggleAddonEnabled(
        !("isMonitoring" in result) || result.isMonitoring
    );
});

// Whenever a page in a tab is done loading, check whether the page
// requires any source file monitoring.
browser.tabs.onUpdated.addListener((id, changeInfo, tab) => {
    if (isMonitoring && tab.status === "complete") {
        disableTabMonitoring(tab.id);
        monitorTabIfEligible(tab);
    }
});

// Stop monitoring and delete from registry  when a tab closes.
browser.tabs.onRemoved.addListener((tabId) => {
    disableTabMonitoring(tabId);
});

// Pick up on messages.
browser.runtime.onMessage.addListener((message, sender) => {
    switch (message.type) {
        case "isMonitoring?":
            browser.runtime.sendMessage({type: "isMonitoring", isMonitoring});
            break;
        case "tabData?":
            browser.runtime.sendMessage({type: "tabData", tabData});
            break;
        case "monitoringChange":
            toggleAddonEnabled(message.isMonitoring);
            break;
        case "reloadRulesChange":
            updateRulesFromStorage();
            break;
        case "optionsChange":
            Object.assign(options, message.options);
            break;
        case "pageSourceFiles":
            pageSourceFilesReceived(message.files, message.rule, sender.tab);
            break;
    }
});

// Record tab when tab URL changes.
browser.tabs.onUpdated.addListener((id, changeInfo, tab) => {
    if (tab.status === "complete") {
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
    const action = {icon: undefined, title: undefined};
    if (enabled) {
        continueMonitoring();
        action.icon = icon;
        action.title = "Live Reload";
    } else {
        disableAllMonitoring();
        action.icon = iconDisabled;
        action.title = "Live Reload (disabled)";
    }
    browser.browserAction.setIcon({path: action.icon});
    browser.browserAction.setTitle({title: action.title});
}

function monitorTabIfEligible(tab) {
    rules.forEach((rule) => {
        // Host matches pattern, start monitoring.
        if (tab.url.match(rule.hostRegExp)) {
            const code = `(${injectSendSourceFiles.toString()})("${rule.id}");`;
            browser.tabs.executeScript(tab.id, {code});
            // Flow continues at case "pageSourceFiles".
        }
    });
}

function injectSendSourceFiles(rule) {
    const js = Array.from(document.querySelectorAll("script[src]"));
    const css = Array.from(document.querySelectorAll("link[rel=stylesheet]"));
    const frames = Array.from(document.querySelectorAll("iframe[src]"));
    const files = {
        [SourceType.HOST]: [location.href],
        [SourceType.CSS]: css.map((el: HTMLLinkElement) => el.href),
        [SourceType.JS]: js.map((el: HTMLScriptElement) => el.src),
        [SourceType.FRAME]: frames.map((el: HTMLIFrameElement) => el.src),
    };
    browser.runtime.sendMessage({type: "pageSourceFiles", rule, files});
}

function injectInlineReload(type, url, updateUrl) {
    const selector = {css: "link[rel=stylesheet]", frame: "iframe[src]"}[type];
    const prop = {css: "href", frame: "src"}[type];
    Array.from(document.querySelectorAll(selector)).forEach((el) => {
        if (el[prop] === url) {
            el[prop] = updateUrl;
        }
    });
}

async function updateRulesFromStorage() {
    const storageRules = await Rule.query();
    rules.length = 0;  // Truncate, but keep reference.
    rules.push(...storageRules);
    restart();
}

// Restart.
function restart() {
    disableAllMonitoring();
    continueMonitoring();
}

function pageSourceFilesReceived(
    files: Record<SourceType, string[]>,
    ruleId: Rule["id"],
    tab: browser.tabs.Tab
) {
    const rule = rules.find((r) => r.id === ruleId);
    if (rule) {
        checkSourceFileMatches(files, rule, tab);
    }
}

function checkSourceFileMatches(
    files: Record<SourceType, string[]>,
    rule: Rule,
    tab: browser.tabs.Tab
) {
    Object.entries(files).forEach(([type, filesOfType]) => {
        (filesOfType as string[]).forEach((url) => {
            rule.sourceRegExps.forEach((regExp) => {
                if (regExp.test(stripNoCacheParam(url))) {
                    checkSourceFileChanged(tab, rule, url, type as SourceType);
                }
            });
        });
    });
}

// Record the last tab so we're able to populate the add reload rule form.
function recordTab(tab: browser.tabs.Tab) {
    if (!tab.incognito && tab.url.match(allUrlsRegExp)) {
        Object.assign(tabData, tab);
    }
}

function disableAllMonitoring() {
    Object.keys(registry).forEach((tabId) => {
        disableTabMonitoring(Number(tabId));
    });
}

function disableTabMonitoring(tabId: number) {
    setBadge(Number(tabId), null);
    Object.values(registry[tabId] || {}).forEach((fileRegistry) => {
        clearTimeout(fileRegistry.timer);
        delete(registry[tabId]);
    });
}

function setBadge(tabId, count) {
    if (options["show.badge"] && isMonitoring && count !== null) {
        browser.browserAction.setBadgeBackgroundColor({color: "black"});
        browser.browserAction.setBadgeText({text: count, tabId});
    } else {
        browser.browserAction.setBadgeText({text: "", tabId});
    }
}

// import {TabStatus, WindowType} from "@types/firefox-webext-browser/index.d";

async function continueMonitoring() {
    const tabs = await browser.tabs.query({
        status: "complete" as browser.tabs.TabStatus.complete,
        windowType: "normal" as browser.tabs.WindowType.normal,
    });
    tabs.forEach((tab) => {
        monitorTabIfEligible(tab);
    });
}

async function checkSourceFileChanged(
    tab: browser.tabs.Tab,
    rule: Rule,
    url: string,
    type: SourceType
) {
    let hash;
    const tabRegistry = registry[tab.id] = registry[tab.id] || {};
    const fileRegistry = tabRegistry[url] = tabRegistry[url] || {timer: null};

    try {
        hash = await getFileHash(url);
    } catch (error) {
        console.error(url, "Error retrieving hash:", error);
    }

    setBadge(tab.id, Object.keys(tabRegistry).length.toString());

    // Check whether the source file hash has changed.
    if (hash && fileRegistry.hash && fileRegistry.hash !== hash) {
        if (
            (type === SourceType.CSS && rule.inlinecss) ||
            (type === SourceType.FRAME && rule.inlineframes)
        ) {
            // Inline reload:
            delete(tabRegistry[url]);
            const source = injectInlineReload.toString();
            const noCacheUrl = getNoCacheURL(url);
            const code = `(${source})("${type}", "${url}", "${noCacheUrl}");`;
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
        fileRegistry.timer = window.setTimeout(() => {
            checkSourceFileChanged(tab, rule, url, type);
        }, rule.intervalMs);
    }
}

// Append a unique string to a URL to avoid cache.
function getNoCacheURL(url: string): string {
    const urlObj = new URL(url);
    const timeHash = new Date().getTime().toString(36).substr(3).toUpperCase();
    urlObj.searchParams.set(nocacheParam, timeHash);
    return urlObj.href;
}

// Strip 'X-LR-NOCACHE' from url so matching won't be affected.
function stripNoCacheParam(url: string): string {
    const urlObj = new URL(url);
    urlObj.searchParams.delete(nocacheParam);
    return urlObj.href;
}

// Get file contents and hash it.
async function getFileHash(url: string): Promise<string> {
    const response = await fetch(url, {cache: "reload"});
    const text = await response.text();
    return sha1(text);
}

// Retrieve the SHA1 hash for a string.
async function sha1(str: string): Promise<string> {
    const encodedText = new TextEncoder().encode(str);
    const sha1Buffer = await crypto.subtle.digest("SHA-1", encodedText);
    const padZeroes = "00000000";
    const dataView = new DataView(sha1Buffer);
    let ret = "";
    for (let i = 0; i < dataView.byteLength; i += 4) {
        const hexString = dataView.getUint32(i).toString(16);
        ret += (padZeroes + hexString).slice(-padZeroes.length);
    }
    return ret;
}
