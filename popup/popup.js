// See addonEnabled in background.js
let addonEnabled = true;

const template = document.querySelector('template#reload-rule');
const enabledElement = document.querySelector('.enabled');
const disabledElement = document.querySelector('.disabled');

// Fetch reload rules from storage.
browser.storage.sync.get('rules').then((result) => {
    updateReloadRules(result.rules);
}).catch((error) => {
    console.error('Error retrieving rules:', error);
});


// Fetch Addon active from background.js.
chrome.runtime.sendMessage({type: 'requestAddonEnabled'});
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'addonEnabled') {
        addonEnabled = message.addonEnabled !== false;
        updatePopupUI();
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
document.querySelectorAll('[data-pop]').forEach((el) => {
    el.addEventListener('click', (event) => {
        window.open(browser.extension.getURL(el.getAttribute('data-pop')),
            'live-reload',
            `width=400,height=600,
            left=${Math.max(20, screen.width - 420)},
            top=${event.screenY + 20}`
        );
    });
});


function updatePopupUI() {
    enabledElement.classList.toggle('hidden', addonEnabled);
    disabledElement.classList.toggle('hidden', !addonEnabled);
}


function updateReloadRules(rules) {
    rules.forEach((rule) => {
        template.content.querySelector('.title').textContent = rule.title;
        document.querySelector('ul#popup-menu').appendChild(
            document.importNode(template.content, true)
        );
    });
}
