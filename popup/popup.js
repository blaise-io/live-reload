// See addonEnabled in background.js
let addonEnabled = true;

const template = document.querySelector('template#reload-rule');
const enabledElement = document.querySelector('.addon-enabled');
const disabledElement = document.querySelector('.addon-disabled');


// Fetch reload rules from storage.
getListRules().then(setReloadRules);


// Fetch Addon active from background.js.
chrome.runtime.sendMessage({type: 'requestAddonEnabled'});
chrome.runtime.onMessage.addListener((message) => {
    switch (message.type) {
        case 'addonEnabled':
            addonEnabled = message.addonEnabled;
            updatePopupUI();
            break;
    }
});


// Handle clicks on enabled/disabled state.
document.querySelectorAll('.toggle').forEach((toggle) => {
    toggle.addEventListener('click', () => {
        addonEnabled = !addonEnabled;
        browser.storage.local.set({addonEnabled});
        chrome.runtime.sendMessage({type: 'addonEnabledChanged', addonEnabled});
        updatePopupUI();
    });
});


// Click handler.
document.body.addEventListener('click', (event) => {
    const deleteTrigger = event.target.closest('.option-delete');
    if (deleteTrigger) {
        // TODO: Create data-pop
        const container = event.target.closest('.split');
        const title = container.querySelector('.text').textContent;
        const id = container.querySelector('[data-rule-id]').getAttribute('data-rule-id');
        const sure = confirm(`Are you sure you want to delete “${title}”?`);
        if (id && sure) {
            deleteRule(id).then(() => {
                container.parentNode.removeChild(container);
            });
        }
    }

    const popAttr = event.target.closest('[data-pop]');
    if (popAttr) {
        window.open(browser.extension.getURL(popAttr.getAttribute('data-pop')),
            'live-reload',
            `width=400,height=600,
            left=${Math.max(20, screen.width - 420)},
            top=${event.screenY + 20}`
        );
        event.stopPropagation();
        return;
    }
});


function updatePopupUI() {
    enabledElement.classList.toggle('hidden', !addonEnabled);
    disabledElement.classList.toggle('hidden', addonEnabled);
}


function setReloadRules(rules) {
    rules.forEach((rule) => {
        const panel = template.content.querySelector('.panel-list-item.rule');
        panel.querySelector('.text').textContent = rule.title;
        panel.setAttribute('data-rule-id', rule.id);
        panel.setAttribute('data-pop', `form/form.html?rule=${rule.id}`);
        document.querySelector('#rules-list').appendChild(
            document.importNode(template.content, true)
        );
    });
}
