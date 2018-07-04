import * as CleanWebpackPlugin from "clean-webpack-plugin";
import * as ExtractTextPlugin from "extract-text-webpack-plugin";
import * as HtmlWebpackPlugin from "html-webpack-plugin";
import * as MiniCssExtractPlugin from "mini-css-extract-plugin";
import { resolve } from "path";
import * as webpack from "webpack";
import * as ZipPlugin from "zip-webpack-plugin";

const config: webpack.Configuration = {
    entry: {
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
    resolve: {
        extensions: [".ts"],
    },
    module: {
        rules: [
            {
                test: /\/manifest\.ts$/,
                use: ExtractTextPlugin.extract({ use: [] }),
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
                        options: { minimize: true },
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
        ], { verbose: false }),
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
            chunks: ["form"],
            filename: "form.html",
            template: resolve(__dirname, "app/form/form.ejs"),
        }),
        new HtmlWebpackPlugin({
            chunks: ["options"],
            filename: "options.html",
            template: resolve(__dirname, "app/options/options.ejs"),
        }),
        new HtmlWebpackPlugin({
            chunks: ["popup"],
            filename: "popup.html",
            template: resolve(__dirname, "app/popup/popup.ejs"),
        }),
        ...(process.argv.includes("--run-prod") ? [
            new ZipPlugin({
                exclude: /manifest\.js$/,
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
