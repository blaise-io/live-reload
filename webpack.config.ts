import * as CleanWebpackPlugin from "clean-webpack-plugin";
import * as ExtractTextPlugin from "extract-text-webpack-plugin";
import * as HtmlWebpackPlugin from "html-webpack-plugin";
import * as MiniCssExtractPlugin from "mini-css-extract-plugin";
import { resolve } from "path";
import * as webpack from "webpack";
import * as ZipPlugin from "zip-webpack-plugin";

const REQUIRE_POLYFILL = process.env.BROWSER !== "firefox";

function polyfillChunks(...chunks: string[]): string[] {
    return REQUIRE_POLYFILL ? ["polyfill", ...chunks] : chunks;
}

const config: webpack.Configuration = {
    entry: {
        polyfill: resolve(__dirname, "app/polyfill.ts"),
        background: resolve(__dirname, "app/background.ts"),
        form: resolve(__dirname, "app/form/form.ts"),
        manifest: resolve(__dirname, "app/manifest.ts"),
        options: resolve(__dirname, "app/options/options.ts"),
        popup: resolve(__dirname, "app/popup/popup.ts"),
    },
    output: {
        filename: "[name].js",
        path: resolve(`dist/${process.env.BROWSER}`),
    },
    optimization: {
        minimize: false,
        namedChunks: true,
        namedModules: true,
        removeEmptyChunks: true,
    },
    resolve: {
        extensions: [".ts"],
    },
    module: {
        rules: [
            {
                test: /\/manifest\.ts$/,
                use: ExtractTextPlugin.extract({use: []}),
            },
            {
                test: /\.ts$/,
                use: "ts-loader",
            },
            {
                test: /\.css$/,
                use: [
                    MiniCssExtractPlugin.loader,
                    {
                        loader: "css-loader",
                    },
                ],
            },
            {
                test: /\.(png|svg)$/,
                use: [{
                    loader: "file-loader",
                    options: {
                        context: resolve(__dirname, "app"),
                        name: "[path][name].[ext]",
                        outputPath: "",
                        publicPath: "/",
                    },
                }],
            },
        ],
    },
    plugins: [
        new CleanWebpackPlugin([
            resolve(`dist/${process.env.BROWSER}`),
        ], {verbose: false}),
        new webpack.EnvironmentPlugin([
            "BROWSER",
            "npm_package_name",
            "npm_package_version",
            "npm_package_description",
            "npm_package_homepage",
        ]),
        new ExtractTextPlugin("manifest.json"),
        new MiniCssExtractPlugin(),
        new HtmlWebpackPlugin({
            chunks: polyfillChunks("form"),
            filename: "form.html",
            template: resolve(__dirname, "app/form/form.html"),
        }),
        new HtmlWebpackPlugin({
            chunks: polyfillChunks("options"),
            filename: "options.html",
            template: resolve(__dirname, "app/options/options.html"),
        }),
        new HtmlWebpackPlugin({
            chunks: polyfillChunks("popup"),
            filename: "popup.html",
            template: resolve(__dirname, "app/popup/popup.html"),
        }),
        ...(process.argv.includes("--run-prod") ? [
            new ZipPlugin({
                exclude: [
                    /manifest\.(js|js\.map)$/,
                    ...(REQUIRE_POLYFILL ? [] : [/polyfill\.(js|js\.map)$/]),
                ],
                filename: [
                    process.env.npm_package_name,
                    process.env.npm_package_version,
                    process.env.BROWSER,
                ].join("-") + ".zip",
            }),
        ] : []),
    ],
};

export default config;
