'use strict';
const electron = require('electron');
const ipcMain = electron.ipcMain;
const app = electron.app;

// adds debug features like hotkeys for triggering dev tools and reload
require('electron-debug')();

// prevent window being garbage collected
let mainWindow;

function onClosed() {
    // dereference the window
    // for multiple windows store them in an array
    mainWindow = null;
}

function createMainWindow() {
    const win = new electron.BrowserWindow({
        width: 1200,
        height: 800
    });

    win.loadURL(`file://${__dirname}/static/index.html`);
    win.openDevTools();
    win.on('closed', onClosed);

    return win;
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (!mainWindow) {
        mainWindow = createMainWindow();
    }
});

app.on('ready', () => {
    mainWindow = createMainWindow();
})


ipcMain.on('search-keyword', function (event, arg) {
    console.log('channel "search-keyword" on msg:' + arg);
    let mails = require('./libs/data.json');
    event.sender.send('search-reply', mails);
});


ipcMain.on('start-crawl', (event, arg) => {
    console.log('channel "start-crawl" on msg:' + arg);
    var updater = {
        sender: event.sender,
        channel: arg,
        updateProgress: function (progress) {
            this.sender.send(this.channel, {progress: progress});
        }
    };
    crawler(updater);
});

const request = require('request'),
    async = require('async'),
    cheerio = require('cheerio');

function pageCrawl(page, totalPage, updater, crawlNextPage) {
    let pageUrl = 'http://12345.chengdu.gov.cn/moreMail?page=' + page;
    request(pageUrl, (err, response, body) => {
        if (err) throw err;
        let $ = cheerio.load(body),
        $pageMails = $('div.left5 ul li.f12px');
        $pageMails.each(function(i, ele){
            let mailDetailUrl = $(this).find('a').prop('href');
            console.log(mailDetailUrl);
        });

        crawlNextPage();
        updater.updateProgress(Math.floor(page * 100 / totalPage));
    });
}

/**
 * 1. get total page size
 * 2. iterator from page 1 to totalSize
 *    2.1 fetch mails summary list on 1 page
 *    2.2 iterator from mails 1 to maxItems mails summary in 1 page
 *        2.2.1 fetch mails detail from url
 *        2.2.2 save mail to db
 *    2.3 test if none of mails in current page updated? if none, stop crawling or continue step 2.
 *
 * @param url
 */
function crawler(updater) {
    request('http://12345.chengdu.gov.cn/moreMail', (err, response, body) => {
        if (err) throw err;
        let $ = cheerio.load(body),
            totalSize = $('div.pages script').html().match(/iRecCount = \d+/g)[0].match(/\d+/g)[0];
        var totalPageSize = Math.ceil(totalSize / 15),
            pagesCollection = [];
        for (let i = 1; i <= totalPageSize; i++) {
            pagesCollection.push(i);
        }
        async.eachSeries(pagesCollection, function (page, crawlNextPage) {
            pageCrawl(page, totalPageSize, updater, crawlNextPage);
        })
    });
}
