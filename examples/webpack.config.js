import GutenbergWebpackPlugin from "../index.js";

export default {
  mode: "development",
  entry: "./index.js",

  plugins: [
    new GutenbergWebpackPlugin("./blocks", {
      outputPathPrefix: "blocks",
    }),
  ],
};
