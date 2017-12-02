document.addEventListener('input', saveOptions);

let options = {};

const defaultOptionsPromise = fetch(
    browser.extension.getURL('options/defaults.json')
).then((response) => response.json());

const savedOptionsPromise = browser.storage.local.get('options');

Promise.all([defaultOptionsPromise, savedOptionsPromise]).then((result) => {
    options = Object.assign({}, result[0], result[1].options);
    restoreOptions();
    setLastSaved();
});

function restoreOptions() {
    document.querySelectorAll('input[type=checkbox][name]').forEach((input) => {
        input.checked = options[input.name];
    });
}

function saveOptions() {
    options = {'meta.lastSaved': new Date().toISOString()};
    document.querySelectorAll('input[type=checkbox][name]').forEach((input) => {
        options[input.name] = input.checked;
    });
    browser.storage.local.set({options}).then(setLastSaved);
    browser.runtime.sendMessage({type: 'optionsChange', options});
}

function setLastSaved() {
    if (options['meta.lastSaved']) {
        const lastSavedElement = document.querySelector('#last-saved');
        const time = (new Date(options['meta.lastSaved'])).toLocaleString();
        lastSavedElement.textContent = `Last saved ${time}.`;
        lastSavedElement.style.display = 'block';
    }
}
