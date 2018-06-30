import "../icons/check.svg";
import "../icons/cross.svg";
import "../icons/delete.svg";
import "../icons/script.svg";
import "./popup.css";

import { Rule } from "../lib/rule";

// See isMonitoring in background.js
let isMonitoring = true;

const template: HTMLTemplateElement = document.querySelector("#reload-rule");
const enabledElement = document.querySelector(".addon-enabled");
const disabledElement = document.querySelector(".addon-disabled");

// Fetch reload rules from storage.
Rule.query().then(setReloadRules);

// Fetch Addon active from background.js.
browser.runtime.sendMessage({type: "isMonitoring?"});
browser.runtime.onMessage.addListener((message) => {
    switch (message.type) {
        case "isMonitoring":
            isMonitoring = message.isMonitoring;
            updatePopupUI();
            break;
    }
});

// Handle clicks on enabled/disabled state.
Array.from(document.querySelectorAll(".toggle")).forEach((toggle) => {
    toggle.addEventListener("click", () => {
        isMonitoring = !isMonitoring;
        browser.storage.local.set({isMonitoring});
        browser.runtime.sendMessage({type: "monitoringChange", isMonitoring});
        updatePopupUI();
    });
});

// Click handler.
document.body.addEventListener("click", (event) => {
    const clickEl = (event.target as HTMLElement);

    // Delete.
    const deleteTrigger = clickEl.closest(".option-delete");
    if (deleteTrigger) {
        const container = clickEl.closest(".split");
        container.classList.toggle("hidden");
        container.nextElementSibling.classList.toggle("hidden");
        event.stopPropagation();
        return;
    }

    // Confirm delete.
    const confirmDeleteTrigger = clickEl.closest(".option-delete-confirm");
    if (confirmDeleteTrigger) {
        const id = confirmDeleteTrigger.getAttribute("data-rule-id");
        Rule.delete(id).then((rules) => {
            const container = clickEl.closest(".split");
            container.parentNode.removeChild(container.previousElementSibling);
            container.parentNode.removeChild(container);
            updateNoRules(rules);
        });
        event.stopPropagation();
        return;
    }

    // Cancel Delete.
    const cancelDeleteTrigger = clickEl.closest(".option-delete-cancel");
    if (cancelDeleteTrigger) {
        const container = clickEl.closest(".split");
        container.previousElementSibling.classList.toggle("hidden");
        container.classList.toggle("hidden");
        event.stopPropagation();
        return;
    }

    // Popup.
    const popAttr = clickEl.closest("[href]");
    if (popAttr) {
        const url = browser.extension.getURL(popAttr.getAttribute("href"));
        browser.windows.create({
            url,
            type: "popup" as browser.windows.CreateType.popup,
            width: 410,
            height: 700,
            left: event.screenX - 390,
            top: event.screenY - 20,
        });
        event.stopPropagation();
        event.preventDefault();
        return;
    }
});

function updatePopupUI() {
    enabledElement.classList.toggle("hidden", !isMonitoring);
    disabledElement.classList.toggle("hidden", isMonitoring);
}

function setReloadRules(rules) {
    updateNoRules(rules);
    rules.forEach((rule) => {
        const panel = template.content.querySelector(".panel-list-item.rule");
        const dataRuleEl = template.content.querySelector("[data-rule-id]");
        panel.querySelector(".text").textContent = rule.title;
        panel.setAttribute("href", `/form.html?rule=${rule.id}`);
        dataRuleEl.setAttribute("data-rule-id", rule.id);
        document.querySelector("#rules-list").appendChild(
            document.importNode(template.content, true)
        );
    });
}

function updateNoRules(rules) {
    const noRules = document.getElementById("no-rules");
    noRules.classList.toggle("hidden", rules.length >= 1);
}
