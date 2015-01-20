var Client = require('ftp');
var extend = require('cog/extend');
var kgo = require('kgo');
var path = require('path');
var mkdirp = require('mkdirp');
var request = require('hyperquest');
var formatter = require('formatter');
var reBetaRelease = /b\d+$/;
var platformExts = {
  'linux-x86_64': '.tar.bz2'
};

function addMajorVersion(item) {
  return extend(item, {
    majorVersion: parseInt(item.name, 10)
  });
};

function requireMajorVersion(item) {
  return !isNaN(item.majorVersion);
}

function sortByMajorVersion(a, b) {
  return (a.majorVersion - b.majorVersion) || a.name.localeCompare(b.name);
}

function notBeta(item) {
  return !reBetaRelease.test(item.name);
}

var foxes = module.exports = function(opts, callback) {
  var versions = (opts || {}).versions || ['stable', 'beta', 'developer'];
  var server = (opts || {}).server || 'ftp.mozilla.org';
  var releasePath = (opts || {}).releasePath || '/pub/mozilla.org/firefox/releases/';
  var localFiles = (opts || {}).localFiles || path.resolve(__dirname, 'browsers');
  var platform = (opts || {}).platform || 'linux-x86_64';
  var region = (opts || {}).region || 'en-US';

  var client = new Client();

  function findVersions(items, callback) {
    // orgarnise the versions
    items = items
      .map(addMajorVersion)
      .filter(requireMajorVersion)
      .sort(sortByMajorVersion);

    callback(null, {
      stable: items.filter(notBeta).slice(-1)[0],
      beta: items.slice(-1)[0],
      latest: { name: 'latest' }
    });
  }

  function download(targetVersion) {
    var urlize = formatter('http://{{ server }}{{ path }}{{ platform }}/{{ region }}/{{ release }}/{{ file }}');
    return function(paths, callback) {
      var item = paths[targetVersion];
      var url = 'http://' + server + releasePath + item.name + '/' + platform + '/' + region;

      // add the item url
      url += '/firefox-' + item.name + (platformExts[platform] || '.zip');

      console.log(url);
      callback();
    };
  }

  client.connect({ host: server });
  client.on('ready', function() {
    kgo
    ('list', client.list.bind(client, releasePath))
    ('localBrowserPath', mkdirp.bind(null, localFiles))
    ('findVersions', ['list', '!localBrowserPath'], findVersions)
    ('stable', ['findVersions'], download('stable'))
    ('beta', ['findVersions'], download('beta'))
    ('latest', ['findVersions'], download('latest'))
    ('bye', ['!stable', '!beta', '!latest'], client.end.bind(client))
    .on('error', callback)
  });
};
