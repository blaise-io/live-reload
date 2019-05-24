import * as iconDisabled from "./icons/icon-disabled.png";
import * as icon from "./icons/icon.png";
import * as matchPattern from "./lib/match-pattern";
import { Rule } from "./lib/rule";
import { defaults, UserOptions } from "./options/defaults";

let isMonitoring: boolean = true;

interface IFileProperties {
    timer?: number;
    hash?: string;
}

interface IFileRecord extends Record<string, IFileProperties> {}

const NO_CACHE_PARAM = "X-LR-NOCACHE";
const tabData = {};
const registry: Record<number, IFileRecord> = {};
const options: UserOptions = {};
const rules: Rule[] = [];

const enum SourceType {
    HOST = "HOST",
    CSS = "CSS",
    JS = "JS",
    FRAME = "FRAME",
}

(async () => {
    const optionsResult = await browser.storage.local.get("options");
    const userOptions = "options" in optionsResult ? optionsResult.options : {};
    Object.assign(options, defaults, userOptions);
    updateRulesFromStorage();
})();

// Fetch active state.
browser.storage.local.get("isMonitoring").then((result) => {
    toggleAddonEnabled(
        !("isMonitoring" in result) || result.isMonitoring,
    );
});

// Whenever a page in a tab is done loading, check whether the page
// requires any source file monitoring.
browser.tabs.onUpdated.addListener((_, __, tab) => {
    if (isMonitoring && tab.status === "complete" && tab.id) {
        disableTabMonitoring(tab.id);
        monitorTabIfRuleMatch(tab);
    }
});

// Stop monitoring and delete from registry  when a tab closes.
browser.tabs.onRemoved.addListener((tabId) => {
    disableTabMonitoring(tabId);
});

// Pick up on messages.
browser.runtime.onMessage.addListener(async (message, sender) => {
    console.info("Incoming message from ", sender.url, message);
    switch (message.type) {
        case "isMonitoring?":
            browser.runtime.sendMessage({ type: "isMonitoring", isMonitoring });
            break;
        case "tabData?":
            browser.runtime.sendMessage({ type: "tabData", tabData });
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
            if (sender.tab) {
                pageSourceFilesReceived(message.files, message.rule, sender.tab);
            }
            break;
    }
    await true;
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
function toggleAddonEnabled(enabled: boolean) {
    isMonitoring = enabled;
    let iconPath: string;
    let title: string;
    if (enabled) {
        continueMonitoring();
        iconPath = icon;
        title = "Live Reload";
    } else {
        disableAllMonitoring();
        iconPath = iconDisabled;
        title = "Live Reload (disabled)";
    }
    browser.browserAction.setIcon({ path: iconPath });
    browser.browserAction.setTitle({ title });
}

async function monitorTabIfRuleMatch(tab: browser.tabs.Tab) {
    for (const rule of rules) {
        // Host matches pattern, start monitoring.
        if (tab.id && tab.url && tab.url.match(rule.hostRegExp)) {
            console.debug("Host pattern", rule.hostRegExp, "matches", tab.url);

            // Chrome et al need the browser polyfill to be loaded first.
            if (process.env.BROWSER !== "firefox") {
                // Don't use browser.extension.getURL() here, breaks Chrome.
                console.debug("Inject polyfill");
                const file = "/polyfill.js";
                await browser.tabs.executeScript(tab.id as number, {file});
            }

            console.debug("Inject send source files");
            const code = `(${injectSendSourceFiles.toString()})("${rule.id}");`;
            browser.tabs.executeScript(tab.id, { code });
            // Flow continues at case "pageSourceFiles".
        }
    }
}

/**
 * Send source file data from the host page to pageSourceFilesReceived().
 * Injected into the host page.
 */
function injectSendSourceFiles(rule: Rule) {
    const css: HTMLLinkElement[] = Array.from(
        document.querySelectorAll("link[rel=stylesheet]"),
    );
    const js: HTMLScriptElement[] = Array.from(
        document.querySelectorAll("script[src]"),
    );
    const frames: HTMLIFrameElement[] = Array.from(
        document.querySelectorAll("iframe[src]"),
    );
    browser.runtime.sendMessage({ type: "pageSourceFiles", rule, files: {
        [SourceType.HOST]: [location.href],
        [SourceType.CSS]: css.map((element) => element.href),
        [SourceType.JS]: js.map((element) => element.src),
        [SourceType.FRAME]: frames.map((element) => element.src),
    }});
}

/**
 * Replace inline frames and stylesheet includes.
 * Injected into the host page.
 */
function injectInlineReload(type: SourceType, url: string, updateUrl: string) {
    if (type === SourceType.CSS) {
        const styles: HTMLLinkElement[] = Array.from(
            document.querySelectorAll("link[rel=stylesheet]"),
        );
        styles.forEach((element) => {
            if (element.href === url) {
                element.href = updateUrl;
            }
        });
    } else if (type === SourceType.FRAME) {
        const frames: HTMLFrameElement[] = Array.from(
            document.querySelectorAll("iframe[src]"),
        );
        frames.forEach((element) => {
            if (element.src === url) {
                element.src = updateUrl;
            }
        });
    }
}

async function updateRulesFromStorage() {
    console.debug("Update rules from storage");
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
    tab: browser.tabs.Tab,
) {
    const rule = rules.find((r) => r.id === ruleId);
    if (rule) {
        checkSourceFileMatches(files, rule, tab);
    }
}

function anyRuleMatch(regExps: RegExp[], urlNoCache: string): boolean {
    const regexp = regExps.find((regExp) => regExp.test(urlNoCache));
    if (regexp) {
        console.debug("Source pattern", regexp, "matches", urlNoCache);
        return true;
    }
    return false;
}

function checkSourceFileMatches(
    files: Record<SourceType, string[]>,
    rule: Rule,
    tab: browser.tabs.Tab,
) {
    Object.entries(files).forEach(([type, filesOfType]) => {
        (filesOfType as string[]).forEach((url) => {
            const urlNoCache = stripNoCacheParam(url);
            if (
                anyRuleMatch(rule.sourceRegExps, urlNoCache) &&
                !anyRuleMatch(rule.ignoresRegExps, urlNoCache)
            ) {
                checkSourceFileChanged(tab, rule, url, type as SourceType);
            }
        });
    });
}

// Record the last tab so we're able to populate the add reload rule form.
function recordTab(tab: browser.tabs.Tab) {
    if (!tab.incognito && tab.url && tab.url.match(matchPattern.ALL_URLS_RE)) {
        Object.assign(tabData, tab);
    }
}

function disableAllMonitoring() {
    console.debug("Disable monitoring");
    Object.keys(registry).forEach((tabId) => {
        disableTabMonitoring(Number(tabId));
    });
}

function disableTabMonitoring(tabId: number) {
    setBadge(Number(tabId), null);
    Object.values(registry[tabId] || {}).forEach((fileRegistry) => {
        clearTimeout(fileRegistry.timer);
        delete registry[tabId];
    });
}

function setBadge(tabId: number, count: number | null) {
    if (options["show.badge"] && isMonitoring && count !== null) {
        browser.browserAction.setBadgeBackgroundColor({ color: "black" });
        browser.browserAction.setBadgeText({ text: count.toString(), tabId });
    } else {
        browser.browserAction.setBadgeText({ text: "", tabId });
    }
}

async function continueMonitoring() {
    console.debug("Continue monitoring");
    const tabs = await browser.tabs.query({
        status: "complete",
        windowType: "normal",
    });
    tabs.forEach(monitorTabIfRuleMatch);
}

async function checkSourceFileChanged(
    tab: browser.tabs.Tab,
    rule: Rule,
    url: string,
    type: SourceType,
) {
    let hash;

    if (!isMonitoring) {
        return;
    }

    tab.id = tab.id || 0;
    const tabRegistry = registry[tab.id] = registry[tab.id] || {};
    const fileRegistry = tabRegistry[url] = tabRegistry[url] || { timer: null };

    try {
        hash = await getFileHash(url);
    } catch (error) {
        console.error(url, "Error retrieving hash:", error);
    }

    setBadge(tab.id, Object.keys(tabRegistry).length);

    // Check whether the source file hash has changed.
    if (hash && fileRegistry.hash && fileRegistry.hash !== hash) {
        console.debug("File changed", url);
        if (
            (type === SourceType.CSS && rule.inlinecss) ||
            (type === SourceType.FRAME && rule.inlineframes)
        ) {
            console.debug("Reload inline");
            delete tabRegistry[url];
            const source = injectInlineReload.toString();
            const noCacheUrl = getNoCacheURL(url);
            const code = `(${source})("${type}", "${url}", "${noCacheUrl}");`;
            browser.tabs.executeScript(tab.id, { code });
            checkSourceFileChanged(tab, rule, noCacheUrl, type);
        } else {
            console.debug("Reload page");
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
    urlObj.searchParams.set(NO_CACHE_PARAM, timeHash);
    return urlObj.href;
}

// Strip 'X-LR-NOCACHE' from url so matching won't be affected.
function stripNoCacheParam(url: string): string {
    const urlObj = new URL(url);
    urlObj.searchParams.delete(NO_CACHE_PARAM);
    return urlObj.href;
}

// Get file contents and hash it.
async function getFileHash(url: string): Promise<string> {
    const response = await fetch(url, { cache: "reload" });
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
