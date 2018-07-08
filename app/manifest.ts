import * as iconImage from "./icons/icon.png";

interface ManifestApplication {
    gecko: {id: string};
}

const manifest = {
    manifest_version: 2,
    name: "Live Reload",
    version: process.env.npm_package_version,
    description: process.env.npm_package_description,
    homepage_url: process.env.npm_package_homepage,
    permissions: ["<all_urls>", "tabs", "storage"],
    applications: undefined as ManifestApplication | undefined,
    background: {
        scripts: ["/background.js"],
    },
    icons: {
        128: iconImage,
    },
    browser_action: {
        browser_style: false as undefined | boolean,
        default_icon: iconImage,
        default_popup: "/popup.html",
    },
    options_ui: {
        page: "/options.html",
        browser_style: undefined as undefined | boolean,
    },
    web_accessible_resources: undefined as undefined | string[],
};

if (process.env.BROWSER === "firefox") {
    manifest.applications = {
        gecko: {
            id: `${process.env.npm_package_name}@blaise.io`,
        },
    };
    manifest.options_ui.browser_style = true;
    manifest.browser_action.browser_style = false;
} else {
    manifest.background.scripts.unshift("/polyfill.js");
    manifest.web_accessible_resources = ["/polyfill.js"];
}

module.exports = JSON.stringify(manifest, null, 2);
