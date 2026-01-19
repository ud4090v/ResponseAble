// Do this as the first thing so that any code reading it knows the right env.
process.env.BABEL_ENV = 'production';
process.env.NODE_ENV = 'production';
process.env.ASSET_PATH = '/';

var webpack = require('webpack'),
  path = require('path'),
  fs = require('fs'),
  config = require('../webpack.config'),
  ZipPlugin = require('zip-webpack-plugin');

delete config.chromeExtensionBoilerplate;

config.mode = 'production';

var packageInfo = JSON.parse(fs.readFileSync('package.json', 'utf-8'));

config.plugins = (config.plugins || []).concat(
  new ZipPlugin({
    filename: `${packageInfo.name}-${packageInfo.version}.zip`,
    path: path.join(__dirname, '../', 'zip'),
  })
);

webpack(config, function (err, stats) {
  if (err) {
    console.error(err);
    throw err;
  }
  
  if (stats.hasErrors()) {
    console.error(stats.toString({
      colors: true,
      all: false,
      errors: true,
      maxModules: Infinity,
      optimizationBailout: true,
      errorDetails: true,
      logging: 'error'
    }));
    process.exit(1);
  }
  
  if (stats.hasWarnings()) {
    console.warn(stats.toString({
      colors: true,
      all: false,
      warnings: true,
      maxModules: Infinity,
      optimizationBailout: true,
      logging: 'warn'
    }));
  }
  
  console.log(stats.toString({
    colors: true,
    chunks: false,
    modules: false,
    children: false,
    entrypoints: false
  }));
  
  console.log('\n✅ Build completed successfully!');
  console.log(`📦 Output directory: ${path.resolve(__dirname, '../build')}`);
});
