const path = require('path');
const {CleanWebpackPlugin} = require('clean-webpack-plugin');
const nodeExternals = require('webpack-node-externals');

const outputDirectory = 'dist';

const serverConfig = (env, {mode}) => ({
  entry: './index.js',
  output: {
    path: path.join(__dirname, outputDirectory),
    filename: 'server.js'
  },  
  resolve: {
    extensions: ['*', '.js']
  },
  plugins: [
    new CleanWebpackPlugin(),
  ],
  target: 'node',
  externals: [nodeExternals()]
});

module.exports = serverConfig;
