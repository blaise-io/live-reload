/**
 * Replace inline frames and stylesheet includes.
 * Injected into the host page.
 */
export function inlineReload(type: browser.webRequest.ResourceType, url: string) {

    if (type === "stylesheet") {
        const selector = document.querySelectorAll("link[rel*=stylesheet]");
        const allLinks = Array.from(selector) as HTMLLinkElement[];
        const filtered = allLinks.filter((h) => h.href === url);

        (filtered.length ? filtered : allLinks).forEach((element) => {
            element.setAttribute("href", getNoCacheURL(element.href));
        });
    }

    if (type === "sub_frame") {
        const selector = document.querySelectorAll("frame[src], iframe[src]");
        const allFrames = Array.from(selector) as HTMLFrameElement[];
        const filtered = allFrames.filter((f) => f.src === url);

        (filtered.length ? filtered : allFrames).forEach((element) => {
            element.setAttribute("src", getNoCacheURL(element.src));
        });
    }

    // Append a unique string to a URL to avoid cache.
    function getNoCacheURL(origUrl: string): string {
        const urlObj = new URL(origUrl);
        const timeHash = new Date().getTime().toString(36).substr(3).toUpperCase();
        urlObj.searchParams.set("X-LR-NOCACHE", timeHash);
        return urlObj.href;
    }
}
