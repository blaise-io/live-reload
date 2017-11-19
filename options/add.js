chrome.runtime.sendMessage({type: 'requestTabData'});

chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'tabData') {
        const data = message.tabData || {};
        if (data.title) {
            let title = `Reload rule for ${data.title.trim()}`;
            document.getElementById('title').value = title;
        }
        if (data.url) {
            document.getElementById('host').value = data.url.replace(
                /^[a-z]+:\/\//, '*://'
            );
        }
    }
});
