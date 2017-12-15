const matchUpdateRule = location.search.match(/rule=([^&$]+)/);
const updateRuleId = matchUpdateRule === null ? null : matchUpdateRule[1];

const hostField = document.getElementById('host');
hostField.pattern = matchPatternRegExp.source;

if (updateRuleId !== null) {
    getRuleById(updateRuleId).then(populateUpdateForm).catch((error) => {
        alert(error);
        window.close();
    });
} else {
    browser.runtime.sendMessage({type: 'tabData?'});
}

browser.runtime.onMessage.addListener(receiveTabData);

document.forms[0].addEventListener('submit', formSubmit);

// Popup to match content.
window.resizeTo(document.body.offsetWidth, document.body.offsetHeight);
window.addEventListener('load', () => {
    document.body.classList.add('loaded');
});


// Received last opened/modified tab data.
// Use to pre-populate some fields.
function receiveTabData(message) {
    if (message.type === 'tabData') {
        const data = message.tabData || {};
        document.body.classList.add('create');
        document.title = 'Create a new reload rule';
        browser.runtime.onMessage.removeListener(receiveTabData);
        if (data.title) {
            let title = `Reload rule for ${data.title.trim()}`;
            document.getElementById('title').value = title;
        }
        hostField.value = data.url || '';
        document.querySelector('[name=inlinecss]').checked = true;
        document.querySelector('[name=inlineframes]').checked = true;
    }
}


// Updating a rule, pre-populate the form with the rule.
function populateUpdateForm(rule) {
    document.body.classList.add('update');
    document.title = `Update: ${rule.title}`;
    document.querySelector('h2.update').textContent = document.title;
    Object.entries(rule).forEach(([key, value]) => {
        const input = document.querySelector(`[name="${key}"]`);
        if (input && value instanceof Array) {
            input.value = value.join('\n\n');
        } else if (input && input.type === 'checkbox') {
            input.checked = value;
        } else if (input) {
            input.value = value;
        }
    });
}


// Get values from the populated form as structured data.
function getFormData(form) {
    const values = {};
    Array.from(form.elements).forEach((input) => {
        if (input.type === 'checkbox') {
            values[input.name] = input.checked;
        } else if (input.name) {
            values[input.name] = input.value.trim();
        }
    });
    values.interval = Number(values.interval);
    values.sources = values.sources.split(/[\n]+/g).map((s) => s.trim());
    return values;
}


// Form submit handler.
async function formSubmit(event) {
    const rule = getFormData(event.target);
    let error = false;

    event.preventDefault();

    rule.id = rule.id || Math.random().toString(36).substr(2);
    rule.created = rule.created || (new Date()).toString();
    rule.modified = (new Date()).toString();
    rule.sources.forEach((source) => {
        if (!error && !matchPatternRegExp.exec(source)) {
            window.alert(`Not saved!\n\nInvalid match pattern:\n\n${source}`);
            document.getElementById('sources').focus();
            error = true;
        }
    });

    if (error) {
        return;
    }

    let rules;

    if (updateRuleId) {
        rules = await updateRule(updateRuleId, rule);
    } else {
        rules = await createRule(rule);
    }

    browser.runtime.sendMessage({type: 'reloadRulesChange', rules});

    window.alert('Saved!');
    window.close();
}
