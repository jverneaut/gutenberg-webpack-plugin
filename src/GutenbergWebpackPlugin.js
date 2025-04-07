import * as glob from "glob";
import fs from "fs";
import path from "path";
import CopyPlugin from "copy-webpack-plugin";
import DependencyExtractionWebpackPlugin from "@wordpress/dependency-extraction-webpack-plugin";

class GutenbergWebpackPlugin {
  /**
   * @param {string} blocksFolderPath The directory containing your blocks
   * @param {object} options
   * @param {string} options.outputPathPrefix The build output path prefix (default: "blocks")
   */
  constructor(blocksFolderPath, options = {}) {
    this.blocksFolderPath = blocksFolderPath;
    this.outputPathPrefix =
      options.outputPathPrefix === undefined
        ? "blocks"
        : options.outputPathPrefix;
  }

  apply(compiler) {
    const blocks = this.getBlocks(compiler.context);

    compiler.options.entry = {
      ...compiler.options.entry,
      ...this.getEntries(blocks),
    };

    if (Object.keys(blocks).length) {
      new CopyPlugin({
        patterns: this.getCopyPatterns(blocks),
      }).apply(compiler);
    }

    new DependencyExtractionWebpackPlugin().apply(compiler);
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
                return JSON.stringify(JSON.parse(content));
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
