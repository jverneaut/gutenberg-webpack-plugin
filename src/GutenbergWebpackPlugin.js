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
   * @param {string} options.disableCssLoaders Disable CSS loaders if you're config already has some
   * @param {string} options.disableSassLoaders Disable SASS loaders if you're config already has some
   */
  constructor(blocksFolderPath, options = {}) {
    this.isProduction = process.env.NODE_ENV === "production";
    this.blocksFolderPath = blocksFolderPath;
    this.outputPathPrefix =
      options.outputPathPrefix === undefined
        ? "blocks"
        : options.outputPathPrefix;

    this.disableCssLoaders = options.disableCssLoaders ?? false;
    this.disableSassLoaders = options.disableSassLoaders ?? false;
  }

  addEntries(compiler, compilation) {
    const blocks = this.getBlocks(compilation.context);
    const entries = this.getEntries(blocks);

    Object.entries(entries).forEach(([key, value]) => {
      const relativePath = path.relative(compilation.context, value);

      const entry = path.join(compilation.context, relativePath);
      const dependency = compilation.webpack.EntryPlugin.createDependency(
        entry,
        key,
      );

      compiler.hooks.make.tapAsync(
        this.constructor.name,
        (compilation, callback) => {
          compilation.addEntry(compiler.context, dependency, key, (err) => {
            callback(err);
          });
        },
      );
    });

    if (Object.keys(blocks).length) {
      new CopyPlugin({
        patterns: this.getCopyPatterns(blocks),
      }).apply(compiler);
    }
  }

  apply(compiler) {
    compiler.hooks.watchRun.tap(this.constructor.name, (compilation) => {
      this.addEntries(compiler, compilation);
    });

    compiler.hooks.beforeRun.tap(this.constructor.name, (compilation) => {
      this.addEntries(compiler, compilation);
    });

    compiler.hooks.afterCompile.tapPromise(
      this.constructor.name,
      async (compilation) => {
        compilation.contextDependencies.add(this.blocksFolderPath);
      },
    );

    compiler.options.externals = ({ request }, callback) => {
      const WORDPRESS_NAMESPACE = "@wordpress/";
      const BUNDLED_PACKAGES = [
        "@wordpress/icons",
        "@wordpress/interface",
        "@wordpress/style-engine",
      ];

      if (
        request.startsWith(WORDPRESS_NAMESPACE) &&
        !BUNDLED_PACKAGES.includes(request)
      ) {
        return callback(null, request, "commonjs2");
      }

      return callback();
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
    const cssLoaders = this.disableCssLoaders
      ? []
      : [
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

    const sassLoaders = this.disableSassLoaders
      ? []
      : [
          {
            loader: "sass-loader",
            options: {
              sourceMap: !this.isProduction,
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
        use: [...cssLoaders, ...sassLoaders],
      },
    ];

    // Add JS rules
    compiler.options.module.rules = [
      ...compiler.options.module.rules,
      {
        test: /\.(js|jsx)$/,
        include: path.resolve(compiler.context, this.blocksFolderPath),
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env", "@babel/preset-react"],
          },
        },
      },
    ];

    // Clean output folder
    new CleanWebpackPlugin({
      cleanOnceBeforeBuildPatterns: [
        path.join(compiler.options.output.path, this.outputPathPrefix, "**/*"),
      ],
    }).apply(compiler);

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
        const blockOutputPath = path.join(
          this.outputPathPrefix,
          path.basename(blockBasePath),
        );

        const block = {
          entries: {},
          copyPatterns: [
            {
              from: curr,
              to: path.join(blockOutputPath, "block.json"),
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

            // Copy php files
            if (filePath.endsWith(".php")) {
              block.copyPatterns.push({
                from: filePath,
                to: path.join(blockOutputPath, path.basename(filePath)),
              });
            } else if (filePath.endsWith(".js")) {
              // Add js files to entries
              block.entries[
                path.join(blockOutputPath, path.basename(filePath, ".js"))
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
        entries[key] = value;
      }
    }

    return entries;
  }

  getCopyPatterns(blocks) {
    return Object.values(blocks).flatMap((block) => block.copyPatterns);
  }
}

export default GutenbergWebpackPlugin;
