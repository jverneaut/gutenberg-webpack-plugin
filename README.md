# GutenbergWebpackPlugin

A lightweight, developer-friendly alternative to `@wordpress/scripts` that simplifies the setup and build process for custom Gutenberg blocks. It’s designed to integrate easily into any existing Webpack configuration with minimal boilerplate.

This plugin gets you up and running with Gutenberg block development with minimal effort. It also integrates nicely with my other package: [HTML To Gutenberg](https://github.com/jverneaut/html-to-gutenberg).

## Installation

```sh
# Install GutenbergWebpackPlugin
npm install --save-dev @jverneaut/gutenberg-webpack-plugin

# Install Babel dependencies (if not already set up)
npm install --save-dev @babel/core @babel/preset-env @babel/preset-react babel-loader

# Install Webpack (if not already set up)
npm install --save-dev webpack webpack-cli
```

## Usage

```js
// webpack.config.js
import GutenbergWebpackPlugin from "@jverneaut/gutenberg-webpack-plugin";

export default {
  mode: "development",
  entry: "./index.js", // your main app entry for non-Gutenberg stuff

  plugins: [
    new GutenbergWebpackPlugin("./blocks", {
      outputPathPrefix: "blocks", // optional, default is "blocks"
    }),
  ],

  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env", "@babel/preset-react"],
          },
        },
      },
    ],
  },
};
```

## Block Structure

Given an input folder that looks like this:

```
blocks/
└── example-block/
    ├── block.json
    ├── edit.js
    ├── index.js
    └── render.php
```

In your block.json, reference files like so:

```json
{
  "name": "custom/example-block",
  "editorScript": "file:./index.js",
  "render": "file:./render.php"
}
```

The plugin will:

- Add index.js as a Webpack entry named `blocks/custom/example-block/index`
- Copy `block.json`, `render.php`, and any other referenced files into the final build output directory
- Create the `*.asset.php` files with `@wordpress/dependency-extraction-webpack-plugin`

## Output

Output files will be written to:

```
dist/
└── blocks/
    └── custom/
        └── example-block/
            ├── block.json
            ├── index.asset.php
            ├── index.js
            ├── render.php
```
