chrome.runtime.sendMessage({type: 'requestTabData'});
chrome.runtime.onMessage.addListener(receiveTabData);

document.forms[0].addEventListener('submit', formSubmit);


function receiveTabData(message) {
    if (message.type === 'tabData') {
        chrome.runtime.onMessage.removeListener(receiveTabData);
        const data = message.tabData || {};
        if (data.title) {
            let title = `Reload rule for ${data.title.trim()}`;
            document.getElementById('title').value = title;
        }
        if (data.url) {
            const host = document.getElementById('host');
            host.pattern = matchPatternRegExp.source;
            host.value = data.url.replace(/^[\w]+:\/\//, '*://');
        }
    }
}


function formSubmit(event) {
    const rule = getFormData(event.target);
    let error = false;

    event.preventDefault();

    rule.id = Math.random().toString(36).substr(2);
    rule.created = (new Date()).toString();
    rule.modified = (new Date()).toString();
    rule.sources.forEach((source) => {
        if (!error && !matchPatternRegExp.exec(source)) {
            window.alert(`Not saved!\n\nInvalid match pattern:\n\n${source}`);
            document.getElementById('sources').focus();
            error = true;
        }
    });

    if (!error) {
        createNewRule(rule);
    }
}


async function createNewRule(rule) {
    try {
        const result = await browser.storage.sync.get('rules');
        return saveRules((result.rules || []).concat(rule));
    } catch (error) {
        window.alert('Cannot access rules: ', error.message);
        console.error(error);
    }
}


function getFormData(form) {
    const values = {};
    Array.from(form.elements).forEach((input) => {
        if (input.name) {
            values[input.name] = input.value.trim();
        }
    });
    values.interval = Number(values.interval);
    values.sources = values.sources.split(/[\n]+/g).map((s) => s.trim());
    return values;
}


function saveRules(rules) {
    browser.storage.sync.set({rules}).then(confirmSaved);
    chrome.runtime.sendMessage({type: 'reloadRulesChanged', rules});
}


function confirmSaved() {
    window.alert('Saved!');
    window.close();
}
