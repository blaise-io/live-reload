/**
 * Runs inside the host page.
 * Report all scripts and styles to background.js.
 */

(function() {
    const scripts = Array.from(document.querySelectorAll('script[src]')).map(
        (el) => el.src
    );

    const styles = Array.from(document.querySelectorAll('link[rel]')).map(
        (el) => el.href
    );

    chrome.runtime.sendMessage({type: 'pageSourceFiles', scripts, styles});
})();
