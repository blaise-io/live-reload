import * as icon from "./icons/icon.png";

const manifest = {
    manifest_version: 2,
    name: "Live Reload",
    description: "Monitors source files on a page. Reloads the page or " +
                 "just the changed stylesheet when source files are updated.",
    version: "1.4.2",
    author: "Blaise Kal",
    homepage_url: "https://github.com/blaise-io/live-reload",
    background: {
        scripts: ["/background.js"]
    },
    icons: {
        128: icon
    },
    browser_action: {
        browser_style: false,
        default_icon: icon,
        default_popup: "/popup.html"
    },
    options_ui: {
        page: "/options.html",
        browser_style: undefined,
    },
    permissions: [
        "<all_urls>",
        "tabs",
        "storage"
    ],
    applications: undefined
};

if (process.env.BROWSER === "firefox") {
    manifest.applications = {
        gecko: {
            id: `${process.env.npm_package_name}@blaise.io`
        }
    };
    manifest.options_ui.browser_style = true;
    manifest.browser_action.browser_style = false;
}

export default JSON.stringify(manifest, null, 2);
