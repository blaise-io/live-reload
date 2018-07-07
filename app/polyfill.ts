// tslint:disable:no-var-requires
if (process.env.BROWSER !== "firefox") {
    window.browser = require("webextension-polyfill");
}
