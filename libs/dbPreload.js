const Datastore = require('nedb');

const db = new Datastore({filename: '~/.electronapp/watcher/12345mails.db', autoload: true});

module.exports = db;
