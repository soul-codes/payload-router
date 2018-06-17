module.exports = {
  mode: "development",
  entry: "./demo/index.ts",
  module: {
    rules: [
      {
        test: /\.js?/,
        exclude: /node_modules/,
        use: "babel-loader?presets=react"
      },
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"]
  },
  output: {
    filename: "demo.js"
  }
};
