// See addonEnabled in background.js
let addonEnabled = true;

const template = document.querySelector('template#reload-rule');
const enabledElement = document.querySelector('.enabled');
const disabledElement = document.querySelector('.disabled');


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


// Popup handler.
document.body.addEventListener('click', (event) => {
    const element = event.target.closest('li');
    if (element) {
        window.open(browser.extension.getURL(element.getAttribute('data-pop')),
            'live-reload',
            `width=400,height=600,
            left=${Math.max(20, screen.width - 420)},
            top=${event.screenY + 20}`
        );
    }
});


function updatePopupUI() {
    enabledElement.classList.toggle('hidden', !addonEnabled);
    disabledElement.classList.toggle('hidden', addonEnabled);
}


function setReloadRules(rules) {
    rules.forEach((rule) => {
        template.content.querySelector('.title').textContent = rule.title;
        template.content.querySelector('li').setAttribute(
            'data-pop', `form/form.html?rule=${rule.id}`
        );
        document.querySelector('ul#popup-menu').appendChild(
            document.importNode(template.content, true)
        );
    });
}
