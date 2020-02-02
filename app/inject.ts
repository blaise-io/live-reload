import {Rule} from "./lib/rule";

export const enum SourceType {
    HOST = "HOST",
    CSS = "CSS",
    JS = "JS",
    FRAME = "FRAME",
}

/**
 * Send source file data from the host page to pageSourceFilesReceived().
 * Injected into the host page.
 */
export function sendSourceFiles(rule: Rule) {
    const css: HTMLLinkElement[] = Array.from(
        document.querySelectorAll("link[rel=stylesheet]"),
    );
    const js: HTMLScriptElement[] = Array.from(
        document.querySelectorAll("script[src]"),
    );
    const frames: HTMLIFrameElement[] = Array.from(
        document.querySelectorAll("iframe[src]"),
    );
    browser.runtime.sendMessage({
        type: "pageSourceFiles", rule, files: {
            [SourceType.HOST]: [location.href],
            [SourceType.CSS]: css.map((element) => element.href),
            [SourceType.JS]: js.map((element) => element.src),
            [SourceType.FRAME]: frames.map((element) => element.src),
        },
    });
}

/**
 * Replace inline frames and stylesheet includes.
 * Injected into the host page.
 */
export function inlineReload(type: SourceType, url: string, updateUrl: string) {
    if (type === SourceType.CSS) {
        const styles: HTMLLinkElement[] = Array.from(
            document.querySelectorAll("link[rel=stylesheet]"),
        );
        styles.forEach((element) => {
            if (element.href === url) {
                element.href = updateUrl;
            }
        });
    } else if (type === SourceType.FRAME) {
        const frames: HTMLFrameElement[] = Array.from(
            document.querySelectorAll("iframe[src]"),
        );
        frames.forEach((element) => {
            if (element.src === url) {
                element.src = updateUrl;
            }
        });
    }
}
