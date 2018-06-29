import {matchPatternRegExp} from "../match-pattern";

const matchUpdateRule = location.search.match(/rule=([^&$]+)/);
const updateRuleId = matchUpdateRule === null ? null : matchUpdateRule[1];

const hostField = document.getElementById("host") as HTMLInputElement;
hostField.pattern = matchPatternRegExp.source;

const filesystemError = `Not saved!
\nDue to security restrictions in addons, local files cannot be monitored.
\nYou can work around this issue by serving your files through a local server.
\nMore info: https://github.com/blaise-io/live-reload/issues/3`;

if (updateRuleId !== null) {
    getRuleById(updateRuleId).then(populateForm).catch((error) => {
        alert(error);
        window.close();
    });
} else {
    browser.runtime.sendMessage({ type: "tabData?" });
}

browser.runtime.onMessage.addListener(receiveTabData);

document.forms[0].addEventListener("submit", formSubmit);

// Popup to match content.
browser.windows.getCurrent().then((window) => {
    browser.windows.update(window.id, { height: document.body.offsetHeight });
    document.body.classList.add("loaded");
});

function getInput(name): HTMLInputElement {
    return document.querySelector(`[name=${name}]`);
}

function getValue(name): HTMLInputElement["value"] {
    return getInput(name).value;
}

function setValue(name, value) {
    const input = getInput(name);
    if (typeof value === "boolean") {
        input.checked = value;
    } else {
        input.value = value;
    }
}

// Received last opened/modified tab data.
// Use to pre-populate some fields.
function receiveTabData(message) {
    if (message.type === "tabData") {
        browser.runtime.onMessage.removeListener(receiveTabData);

        const data = message.tabData || {};
        const title = data.title ?
            `Reload rule for ${data.title.trim()}` :
            "";
        const rule = new Rule(title, data.url || "");

        document.body.classList.add("create");

        populateForm(rule, "create", "Create a new reload rule");
    }
}

// Updating a rule, pre-populate the form with the rule.
function populateForm(rule: Rule, className: string, title: string) {
    document.body.classList.add(className);
    document.title = title;
    document.querySelector("h2.update").textContent = document.title;

    Object.entries(rule).forEach(([key, value]) => {
        const input = getInput(key);
        if (input && value instanceof Array) {
            input.value = value.join("\n\n");
        } else if (input && input.type === "checkbox") {
            input.checked = Boolean(value);
        } else if (input) {
            input.value = String(value);
        }
    });
}

// // Get values from the populated form as structured data.
// function getFormData(form): Rule { // TODO: Create Rule class
//     const values = {};
//     Array.from(form.elements).forEach((input: HTMLInputElement) => {
//         if (input.name === "sources") {
//             values[input.name] = input.value.split(/[\n]+/g).map((s) => s.trim());
//         } else if (input.name === "interval") {
//             values[input.name] = Number(input.value);
//         } else if (input.type === "checkbox") {
//             values[input.name] = input.checked;
//         } else if (input.name) {
//             values[input.name] = input.value.trim();
//         }
//     });
//     // return values;
//     return new Rule(
//         getFieldByName("title").value || undefined,
//         getFieldByName("id").value || undefined,
//         getFieldByName("sources").value || undefined
//     );
// }

// Form submit handler.
async function formSubmit(event) {
    let error = null;

    const rule: Rule = (updateRuleId) ?
        await getRuleById(updateRuleId) :
        new Rule();

    event.preventDefault();

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
        document.getElementById("sources").focus();
        return;
    }

    const rules = (updateRuleId) ?
        await updateRule(updateRuleId, rule) :
        await createRule(rule);

    browser.runtime.sendMessage({ type: "reloadRulesChange", rules });

    window.alert("Saved!");
    window.close();
}
