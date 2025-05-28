import * as glob from "glob";
import fs from "fs";
import path from "path";
import CopyPlugin from "copy-webpack-plugin";
import DependencyExtractionWebpackPlugin from "@wordpress/dependency-extraction-webpack-plugin";
import MiniCSSExtractPlugin from "mini-css-extract-plugin";
import { CleanWebpackPlugin } from "clean-webpack-plugin";
import RemoveEmptyScriptsPlugin from "webpack-remove-empty-scripts";

class GutenbergWebpackPlugin {
  /**
   * @param {string} blocksFolderPath The directory containing your blocks
   * @param {object} options
   * @param {string} options.outputPathPrefix The build output path prefix (default: "blocks")
   */
  constructor(blocksFolderPath, options = {}) {
    this.isProduction = process.env.NODE_ENV === "production";
    this.blocksFolderPath = blocksFolderPath;
    this.outputPathPrefix =
      options.outputPathPrefix === undefined
        ? "blocks"
        : options.outputPathPrefix;
  }

  apply(compiler) {
    const blocks = this.getBlocks(compiler.context);

    // Add entries for found blocks
    compiler.options.entry = {
      ...compiler.options.entry,
      ...this.getEntries(blocks),
    };

    // Split CSS into multiple files
    compiler.options.optimization = {
      ...compiler.options.optimization,
      splitChunks: {
        ...compiler.options.optimization.splitChunks,
        cacheGroups: {
          style: {
            type: "css/mini-extract",
            test: /[\\/]style(\.module)?\.(pc|sc|sa|c)ss$/,
            chunks: "all",
            enforce: true,
            name(_, chunks, cacheGroupKey) {
              const chunkName = chunks[0].name;
              return `${path.dirname(
                chunkName,
              )}/${cacheGroupKey}-${path.basename(chunkName)}`;
            },
          },
          default: false,
        },
      },
    };

    // Set default path if not set
    if (!compiler.options.output.path) {
      compiler.options.output.path = path.resolve(compiler.context, "dist");
    }

    // Add CSS/SASS rules
    const cssLoaders = [
      {
        loader: MiniCSSExtractPlugin.loader,
      },
      {
        loader: "css-loader",
        options: {
          importLoaders: 1,
          sourceMap: !this.isProduction,
          modules: {
            auto: true,
          },
        },
      },
    ];

    compiler.options.module.rules = [
      ...compiler.options.module.rules,
      {
        test: /\.css$/,
        include: path.resolve(compiler.context, this.blocksFolderPath),
        use: cssLoaders,
      },
      {
        test: /\.(sc|sa)ss$/,
        include: path.resolve(compiler.context, this.blocksFolderPath),
        use: [
          ...cssLoaders,
          {
            loader: "sass-loader",
            options: {
              sourceMap: !this.isProduction,
            },
          },
        ],
      },
    ];

    // Clean output folder
    new CleanWebpackPlugin({
      cleanOnceBeforeBuildPatterns: [
        path.join(compiler.options.output.path, this.outputPathPrefix, "**/*"),
      ],
    }).apply(compiler);

    // Copy block files
    if (Object.keys(blocks).length) {
      new CopyPlugin({
        patterns: this.getCopyPatterns(blocks),
      }).apply(compiler);
    }

    // Create *.asset.php files
    new DependencyExtractionWebpackPlugin().apply(compiler);

    // Extract CSS files
    new MiniCSSExtractPlugin({
      filename: "[name].css",
    }).apply(compiler);

    // Remove empty scripts (style.js, etc.)
    new RemoveEmptyScriptsPlugin().apply(compiler);
  }

  getBlocks(basePath) {
    return glob
      .sync(path.join(basePath, this.blocksFolderPath, "**/*.json"))
      .reduce((acc, curr) => {
        const blockJSON = JSON.parse(fs.readFileSync(curr, "utf-8"));
        const blockBasePath = path.dirname(curr);

        const block = {
          entries: {},
          copyPatterns: [
            {
              from: curr,
              to: path.join(
                this.outputPathPrefix,
                `${blockJSON.name}/block.json`,
              ),
              transform(content) {
                return JSON.stringify(JSON.parse(content), null, 2);
              },
            },
          ],
        };

        Object.values(blockJSON).reduce((acc, curr) => {
          if (typeof curr === "string" && curr.indexOf("file:") > -1) {
            const filePath = path.join(
              blockBasePath,
              curr.replace("file:", ""),
            );

            if (filePath.endsWith(".php") || filePath.endsWith(".twig")) {
              block.copyPatterns.push({
                from: filePath,
                to: path.join(
                  this.outputPathPrefix,
                  `${blockJSON.name}/${path.basename(filePath)}`,
                ),
              });
            } else if (filePath.endsWith(".css")) {
              // Do nothing, the file is already handled by webpack
            } else {
              block.entries[
                path.join(
                  this.outputPathPrefix,
                  `/${blockJSON.name}/${path.basename(filePath).split(".")[0]}`,
                )
              ] = filePath;
            }
          }

          return { ...acc };
        }, {});

        return {
          ...acc,
          [blockJSON.name]: block,
        };
      }, {});
  }

  getEntries(blocks) {
    const entries = {};

    for (const block of Object.values(blocks)) {
      for (const [key, value] of Object.entries(block.entries)) {
        entries[key] = { import: [value] };
      }
    }

    return entries;
  }

  getCopyPatterns(blocks) {
    return Object.values(blocks).flatMap((block) => block.copyPatterns);
  }
}

export default GutenbergWebpackPlugin;
