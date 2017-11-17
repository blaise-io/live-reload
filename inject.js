/**
 * Runs inside the host page.
 * Report all scripts and styles to background.js.
 */

chrome.runtime.sendMessage({

    scripts: Array
        .from(document.querySelectorAll('script[src]'))
        .map((el) => el.src),

    styles: Array
        .from(document.querySelectorAll('link[rel]'))
        .map((el) => el.href),

});
