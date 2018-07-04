import { matchPatternRegExp } from "../lib/match-pattern";
import { Rule } from "../lib/rule";
import "./extension.css";
import "./form.css";

const filesystemError = `Not saved!
\nDue to security restrictions in addons, local files cannot be monitored.
\nYou can work around this issue by serving your files through a local server.
\nMore info: https://github.com/blaise-io/live-reload/issues/3`;

loadInitial();

async function loadInitial() {
    const matchUpdateRule = location.search.match(/rule=([^&$]+)/);
    const updateRuleId = matchUpdateRule ? String(matchUpdateRule[1]) : null;

    if (updateRuleId) {
        try {
            const rule = await Rule.get(updateRuleId);
            const title = document.title;
            const h2 = document.querySelector("h2.update") as HTMLHeadingElement;
            populateForm(rule, true, `Update: ${title}`);
            h2.textContent = title;
        } catch (error) {
            alert(error.message);
            window.close();
        }
    } else {
        browser.runtime.sendMessage({ type: "tabData?" });
        browser.runtime.onMessage.addListener(receiveTabData);
    }
}

function getInput(name: string): HTMLInputElement {
    return document.querySelector(`[name=${name}]`) as HTMLInputElement;
}

function getValue(name: string): HTMLInputElement["value"] {
    return getInput(name).value;
}

function setValue(name: string, value: boolean | number | string) {
    const input = getInput(name);
    if (typeof value === "boolean") {
        input.checked = value;
    } else {
        input.value = value.toString();
    }
}

// Received last opened/modified tab data.
function receiveTabData(message: {type: string, tabData: browser.tabs.Tab}) {
    if (message.type === "tabData") {
        browser.runtime.onMessage.removeListener(receiveTabData);

        const data = message.tabData || {};
        const title = data.title ? `Reload rule for ${data.title.trim()}` : "";
        const rule = new Rule(title, data.url || "");

        populateForm(rule, false, "Create a new reload rule");
    }
}

function populateForm(rule: Rule, update: boolean, title: string) {
    document.body.classList.add(update ? "update" : "create");
    document.title = title;

    document.forms[0].addEventListener("submit", (event) => {
        event.preventDefault();
        handleFormSubmit(rule);
        browser.runtime.sendMessage({ type: "reloadRulesChange" });
        window.alert("Saved!");
        window.close();
    });

    popupMatchContentHeight();

    getInput("host").pattern = matchPatternRegExp.source;

    setValue("title", rule.title);
    setValue("host", rule.host);
    setValue("interval", rule.interval);
    setValue("inlinecss", rule.inlinecss);
    setValue("inlineframes", rule.inlineframes);
    setValue("sources", rule.sources.join("\n\n"));
}

function popupMatchContentHeight() {
    browser.windows.getCurrent().then((window: browser.windows.Window) => {
        if (window.id) {
            browser.windows.update(window.id, {
                height: document.body.offsetHeight,
            });
            document.body.classList.add("loaded");
        }
    });
}

// Form submit handler.
async function handleFormSubmit(rule: Rule) {
    let error: string | null = null;

    rule.interval = Number(getValue("interval"));
    rule.modified = new Date();
    rule.sources = getValue("sources").split(/[\n]+/g).map((s) => s.trim());
    rule.sources.forEach((source) => {
        if (!error) {
            if ((/^file:\/\//i).exec(source)) {
                error = filesystemError;
            } else if (!matchPatternRegExp.exec(source)) {
                error = `Not saved!\n\nInvalid match pattern:\n\n${source}`;
            }
        }
    });

    if (error) {
        window.alert(error);
        getInput("sources").focus();
        return;
    }

    await rule.save();
}
