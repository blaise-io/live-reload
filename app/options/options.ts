import { defaults, UserOptions } from "./defaults";

document.addEventListener("change", saveOptions);

let options: UserOptions = {};

init();

async function init() {
    const savedOptions: UserOptions = await browser.storage.local.get("options");
    options = {...defaults, ...savedOptions};
    restoreOptions();
    setLastSaved();
}

function getInputs(): HTMLInputElement[] {
    return Array.from(document.querySelectorAll("input[type=checkbox][name]"));
}

function restoreOptions() {
    const checkboxes = getInputs();
    checkboxes.forEach((input) => {
        input.checked = Boolean(options[input.name]);
    });
}

function saveOptions() {
    options = {"meta.lastSaved": new Date().toISOString()};
    getInputs().forEach((input) => {
        options[input.name] = input.checked;
    });
    browser.storage.local.set({options}).then(setLastSaved);
    browser.runtime.sendMessage({type: "optionsChange", options});
}

function setLastSaved() {
    if (options["meta.lastSaved"]) {
        const lastSavedElement = (
            document.querySelector("#last-saved") as HTMLSpanElement
        );
        const time = (new Date(options["meta.lastSaved"] as string)).toLocaleString();
        lastSavedElement.textContent = `Last saved ${time}.`;
        lastSavedElement.style.display = "block";
    }
}
