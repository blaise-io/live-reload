// Get file contents and hash it.
export async function getFileHash(url: string): Promise<string> {
    const response = await fetch(url, {cache: "reload"});
    const text = await response.text();
    return sha1(text);
}

// Retrieve a SHA1 hash for a string.
async function sha1(str: string): Promise<string> {
    const msgUint8 = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest("SHA-1", msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Strip 'X-LR-NOCACHE' from url so matching won't be affected.
export function stripNoCacheParam(url: string): string {
    const urlObj = new URL(url);
    urlObj.searchParams.delete("X-LR-NOCACHE");
    return urlObj.href;
}

export function anyRegexMatch(regExps: RegExp[], url: string): boolean {
    const regexp = regExps.find((regExp) => regExp.test(url));
    if (regexp) {
        console.debug(url, "matches", regexp);
        return true;
    }
    return false;
}
