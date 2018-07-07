import * as dom from "../lib/dom";
import { MATCH_PATTERN_RE } from "../lib/match-pattern";
import { Rule } from "../lib/rule";
import "./form.css";

const FILESYSTEM_ERROR = `Not saved!
\nDue to security restrictions in addons, local files cannot be monitored.
\nYou can work around this issue by serving your files through a local server.
\nMore info: https://github.com/blaise-io/live-reload/issues/3`;

(async () => {
    const matchUpdateRule = location.search.match(/rule=([^&$]+)/);
    const updateRuleId = matchUpdateRule ? String(matchUpdateRule[1]) : null;

    if (updateRuleId) {
        let rule: Rule | null = null;
        try {
            rule = await Rule.get(updateRuleId);
        } catch (error) {
            alert(error.message);
            window.close();
        }
        if (rule) {
            updateRule(rule);
        }
    } else {
        browser.runtime.sendMessage({ type: "tabData?" });
        browser.runtime.onMessage.addListener(createNewRule);
    }
})();

function updateRule(rule: Rule) {
    console.debug("Update rule", rule);
    const title = `Update: ${rule.title}`;
    const h2 = document.querySelector("h2.update") as HTMLHeadingElement;
    h2.textContent = title;
    populateForm(rule, true, title);
}

async function createNewRule(message: {type: string, tabData: browser.tabs.Tab}) {
    if (message.type === "tabData") {
        browser.runtime.onMessage.removeListener(createNewRule);

        const data = message.tabData || {};
        const title = data.title ? `Reload rule for ${data.title.trim()}` : "";
        const rule = new Rule(title, data.url || "");

        console.debug("New rule", rule);

        populateForm(rule, false, "Create a new reload rule");
    }
    await true;
}

function populateForm(rule: Rule, update: boolean, title: string) {
    document.body.classList.add(update ? "update" : "create");
    document.title = title;

    dom.popupMatchContentHeight();

    dom.getInput("host").pattern = MATCH_PATTERN_RE.source;

    dom.setValue("title", rule.title);
    dom.setValue("host", rule.host);
    dom.setValue("interval", rule.interval);
    dom.setValue("inlinecss", rule.inlinecss);
    dom.setValue("inlineframes", rule.inlineframes);
    dom.setValue("sources", rule.sources.join("\n\n"));

    document.forms[0].addEventListener("submit", async (event) => {
        event.preventDefault();
        await handleFormSubmit(rule);
        browser.runtime.sendMessage({ type: "reloadRulesChange" });
        window.alert("Saved!");
        window.close();
    });
}

async function handleFormSubmit(rule: Rule) {
    const [success, error] = overloadFormData(rule);

    if (!success) {
        window.alert(error);
        dom.getInput("sources").focus();
        return;
    }

    console.debug("Save rule", rule);
    await rule.save();
}

function overloadFormData(rule: Rule): [boolean, string | null] {
    let error: string | null = null;

    rule.interval = Number(dom.getValue("interval"));
    rule.modified = new Date();
    rule.title = dom.getValue("title");
    rule.host = dom.getValue("host");
    rule.inlinecss = Boolean(dom.getInput("inlinecss").checked);
    rule.inlineframes = Boolean(dom.getInput("inlineframes").checked);
    rule.sources = dom.getValue("sources").split(/[\n]+/g).map((s) => s.trim());
    rule.sources.forEach((source) => {
        if (!error) {
            if ((/^file:\/\//i).exec(source)) {
                error = FILESYSTEM_ERROR;
            } else if (!MATCH_PATTERN_RE.exec(source)) {
                error = `Not saved!\n\nInvalid match pattern:\n\n${source}`;
            }
        }
    });

    return [error === null, error];
}
