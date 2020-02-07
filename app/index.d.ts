interface FileRegistry {
    timer?: number;
    hash?: string;
}

interface TabRegistry extends Record<string, FileRegistry> {
}

// Copied from browser.webRequest._WebRequestOnBeforeRequestEvent
interface WebrequestDetails {
    requestId: string;
    url: string;
    method: string;
    frameId: number;
    parentFrameId: number;
    originUrl?: string;
    documentUrl?: string;
    tabId: number;
    type: browser.webRequest.ResourceType;
    timeStamp: number;
    statusLine: string;
    responseHeaders?: browser.webRequest.HttpHeaders;
    statusCode: number;
}
