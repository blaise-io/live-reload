const schemeSegment = "(\\*|http|https|file|ftp|app)";
const hostSegment = "(\\*|(?:\\*\\.)?(?:[^/*]+))?";
const pathSegment = "(.*)";

const ALL_URLS_RE = new RegExp(
    `^${schemeSegment}://`,
);

const MATCH_PATTERN_RE = new RegExp(
    `^${schemeSegment}://${hostSegment}/${pathSegment}$`,
);

function sourceHost(pattern: string): string {
    const match = MATCH_PATTERN_RE.exec(pattern);
    if (match) {
        let [, scheme, host] = match;
        host = host.replace(/:\d{2,5}/, '')  // Drop host port: https://bugzilla.mozilla.org/show_bug.cgi?id=1362809
        pattern = `${scheme}://${host}/*`;
    }
    return pattern
}

function toRegExp(pattern: string): RegExp {
    if (pattern === "<all_urls>") {
        return ALL_URLS_RE;
    }

    const match = MATCH_PATTERN_RE.exec(pattern);
    if (!match) {
        console.error("Invalid pattern", pattern);
        return (/^$/);
    }

    let [, scheme, host, path] = match;

    if (!host) {
        console.error("Invalid host in pattern", pattern);
        return (/^$/);
    }

    let regex = "^";

    if (scheme === "*") {
        regex += "(http|https)";
    } else {
        regex += scheme;
    }

    regex += "://";

    if (host && host === "*") {
        regex += "[^/]+?";
    } else if (host) {
        if (host.match(/^\*\./)) {
            regex += "[^/]*?";
            host = host.substring(2);
        }
        regex += host.replace(/\./g, "\\.");
    }

    if (path) {
        if (path === "*") {
            regex += "(/.*)?";
        } else if (path.charAt(0) !== "/") {
            regex += "/";
            regex += path.replace(/\./g, "\\.").replace(/\*/g, ".*?");
        }
    } else {
        regex += "/?";
    }

    regex += "$";
    return new RegExp(regex);
}

export {
    ALL_URLS_RE,
    MATCH_PATTERN_RE,
    sourceHost,
    toRegExp,
};
