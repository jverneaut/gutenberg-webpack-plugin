import GutenbergWebpackPlugin from "../index.js";

export default {
  entry: "./index.js",

  plugins: [
    new GutenbergWebpackPlugin("./blocks", {
      outputPathPrefix: "blocks",
    }),
  ],
};
