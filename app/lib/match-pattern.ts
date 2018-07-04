const schemeSegment = "(\\*|http|https|file|ftp|app)";
const hostSegment = "(\\*|(?:\\*\\.)?(?:[^/*]+))?";
const pathSegment = "(.*)";

const matchPatternRegExp = new RegExp(
    `^${schemeSegment}://${hostSegment}/${pathSegment}$`,
);

const allUrlsRegExp = new RegExp(
    `^${schemeSegment}://`,
);

function getRegExpForMatchPattern(pattern: string) {
    if (pattern === "<all_urls>") {
        return allUrlsRegExp;
    }

    const match = matchPatternRegExp.exec(pattern);
    if (!match) {
        console.error("Invalid pattern", pattern);
        return (/^$/);
    }

    const scheme = match[1];
    let host = match[2];
    const path = match[3];

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
    matchPatternRegExp,
    getRegExpForMatchPattern,
    allUrlsRegExp,
};