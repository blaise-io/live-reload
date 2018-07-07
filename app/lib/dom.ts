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

export {
    getInput, getValue, setValue, popupMatchContentHeight
};
