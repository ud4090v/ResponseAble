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

var packageInfo = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));
var manifestPath = path.join(__dirname, '../src/manifest.json');
var version = packageInfo.version;
if (fs.existsSync(manifestPath)) {
  try {
    var manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    if (manifest.version) version = manifest.version;
  } catch (e) { /* use package version */ }
}

var downloadsDir = path.join(__dirname, '..', '..', 'Xreplaisite', 'public', 'downloads');
try {
  fs.mkdirSync(downloadsDir, { recursive: true });
} catch (e) {
  console.warn('Could not create downloads dir:', downloadsDir, e.message);
}

config.plugins = (config.plugins || []).concat(
  new ZipPlugin({
    filename: `xreplai-v${version}.zip`,
    path: downloadsDir,
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
  console.log(`📦 Extension zip: ${path.join(downloadsDir, `xreplai-v${version}.zip`)}`);
});
