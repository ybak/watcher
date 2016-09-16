const Datastore = require('nedb');

function getUserHome() {
    return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
}

const db = new Datastore({filename: getUserHome()+'/.electronapp/watcher/12345mails.db', autoload: true});

module.exports = db;
