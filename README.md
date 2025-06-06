# GutenbergWebpackPlugin

A lightweight webpack plugin that simplifies the setup and build process for custom Gutenberg blocks. It’s designed to integrate easily into any existing Webpack configuration with minimal boilerplate.

It uses a lot of parts from [@worpress/scripts](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-scripts/).

It also integrates nicely with my other package: [HTML To Gutenberg](https://github.com/jverneaut/html-to-gutenberg).

## Installation

```sh
# Install GutenbergWebpackPlugin
npm install --save-dev @jverneaut/gutenberg-webpack-plugin

# Install Webpack (if not already set up)
npm install --save-dev webpack webpack-cli
```

## Usage

```js
// webpack.config.js
import GutenbergWebpackPlugin from "@jverneaut/gutenberg-webpack-plugin";

export default {
  entry: "./index.js", // your main app entry for non-Gutenberg stuff

  plugins: [
    // "./blocks" is your blocks folder
    new GutenbergWebpackPlugin("./blocks", {
      outputPathPrefix: "blocks", // optional, default is "blocks"
    }),
  ],
};
```

If you have issues making it work with an existing webpack config that is already setup to build CSS and SASS files, you can use the `disableCssLoaders` and `disableSassLoaders` options.

```js
new GutenbergWebpackPlugin("./blocks", {
  disableCssLoaders: true,
  disableScssLoaders: true,
});
```

This will prevent conflicts between the two and should properly handle styles as long as your webpack config is standard enough.

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
