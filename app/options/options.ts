document.addEventListener("change", saveOptions);

let options = {};

Promise.all([
    fetch(browser.extension.getURL("/options/defaults.json"))
        .then((response) => response.json()),
    browser.storage.local.get("options"),
]).then((result) => {
    options = Object.assign({}, result[0], result[1].options);
    restoreOptions();
    setLastSaved();
});

function getInputs(): HTMLInputElement[] {
    return Array.from(document.querySelectorAll("input[type=checkbox][name]"));
}

function restoreOptions() {
    const checkboxes = getInputs();
    checkboxes.forEach((input) => {
        input.checked = options[input.name];
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
        const time = (new Date(options["meta.lastSaved"])).toLocaleString();
        lastSavedElement.textContent = `Last saved ${time}.`;
        lastSavedElement.style.display = "block";
    }
}
