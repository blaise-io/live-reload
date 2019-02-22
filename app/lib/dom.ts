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

async function popupMatchContentHeight() {
    const window = await browser.windows.getCurrent();
    browser.windows.update(window.id as number, {
        height: document.documentElement.offsetHeight + 20,
    });
    document.body.classList.add("loaded");
}

async function closeWindow() {
    const window = await browser.windows.getCurrent();
    browser.windows.remove(window.id as number);
}

export {
    closeWindow,
    getInput,
    getValue,
    setValue,
    popupMatchContentHeight,
};
