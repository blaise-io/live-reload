import "../icons/check.svg";
import "../icons/cross.svg";
import "../icons/delete.svg";
import "../icons/script.svg";
import { Rule } from "../lib/rule";
import "./popup.css";

// See isMonitoring in background.js
let isMonitoring = true;

const template = document.querySelector("#reload-rule") as HTMLTemplateElement;
const enabledElement = document.querySelector(".addon-enabled") as HTMLElement;
const disabledElement = document.querySelector(".addon-disabled") as HTMLElement;

// Fetch reload rules from storage.
(async () => {
    const rules = await Rule.query();
    console.debug("Rules x", rules);
    setReloadRules(rules);
})();

// Fetch Addon active from background.js.
browser.runtime.sendMessage({type: "isMonitoring?"});
browser.runtime.onMessage.addListener(async (message) => {
    switch (message.type) {
        case "isMonitoring":
            isMonitoring = message.isMonitoring;
            updatePopupUI();
            break;
    }
    await true;
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
        const container = clickEl.closest(".split") as HTMLDivElement;
        container.classList.toggle("hidden");
        (container.nextElementSibling as HTMLDivElement).classList.toggle("hidden");
        event.stopPropagation();
        return;
    }

    // Confirm delete.
    const confirmDeleteTrigger = clickEl.closest(".option-delete-confirm");
    if (confirmDeleteTrigger) {
        const id = confirmDeleteTrigger.getAttribute("data-rule-id") as string;
        Rule.delete(id).then(() => {
            const container = clickEl.closest(".split") as HTMLDivElement;
            const parent = container.parentNode as HTMLElement;
            parent.removeChild(container.previousElementSibling as HTMLElement);
            parent.removeChild(container);
        });
        Rule.query().then(updateNoRules);
        event.stopPropagation();
        return;
    }

    // Cancel Delete.
    const cancelDeleteTrigger = clickEl.closest(".option-delete-cancel");
    if (cancelDeleteTrigger) {
        const container = clickEl.closest(".split") as HTMLDivElement;
        const previous = container.previousElementSibling as HTMLDivElement;
        previous.classList.toggle("hidden");
        container.classList.toggle("hidden");
        event.stopPropagation();
        return;
    }

    // Popup.
    const popAttr = clickEl.closest("[href]");
    if (popAttr) {
        const href = popAttr.getAttribute("href") as string;
        const url = browser.extension.getURL(href);
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

function setReloadRules(rules: Rule[]) {
    updateNoRules(rules);
    rules.forEach((rule) => {
        const panel = template.content.querySelector(".panel-list-item.rule") as HTMLElement;
        const dataRuleEl = template.content.querySelector("[data-rule-id]") as HTMLElement;
        const dataText = panel.querySelector(".text") as HTMLSpanElement;
        dataText.textContent = rule.title;
        panel.setAttribute("href", `/form.html?rule=${rule.id}`);
        dataRuleEl.setAttribute("data-rule-id", rule.id);
        (document.querySelector("#rules-list") as HTMLElement).appendChild(
            document.importNode(template.content, true),
        );
    });
}

function updateNoRules(rules: Rule[]) {
    const noRules = document.getElementById("no-rules") as HTMLElement;
    noRules.classList.toggle("hidden", rules.length >= 1);
}
