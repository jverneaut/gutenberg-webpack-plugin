import GutenbergWebpackPlugin from "../index.js";

export default {
  mode: "development",
  entry: "./index.js",

  plugins: [
    new GutenbergWebpackPlugin("./blocks", {
      outputPathPrefix: "blocks",
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
