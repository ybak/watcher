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


const request = require('request'),
    async = require('async'),
    db = require('./libs/dbPreload'),
    cheerio = require('cheerio');

ipcMain.on('search-keyword', function (event, keyword) {
    console.log('channel "search-keyword" on msg:' + keyword);

    let match = {$regex: eval('/' + keyword + '/')};
    var query = keyword ? {$or: [{title: match}, {content: match}]} : {};
    db.find(query).sort({publishDate: -1}).limit(100).exec(function (err, mails) {
        event.sender.send('search-reply', {mails: mails});
    });
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

function UrlCrawler(targetUrl) {
    return {
        targetUrl: targetUrl,
        startCrawl: function (processDom) {
            request(this.targetUrl, (err, response, body) => {
                if (err) throw err;
                var $ = cheerio.load(body);
                processDom($)
            });
        }
    };
}

function pageCrawl(page, totalPage, updater, crawlNextPage) {
    new UrlCrawler('http://12345.chengdu.gov.cn/moreMail?page=' + page).startCrawl(($) => {
        var $pageMails = $('div.left5 ul li.f12px');

        async.eachOfLimit($pageMails, 10, function iteratee(item, key, nextMail) {
            let $item = $(item),
                mailDetailUrl = $item.find('a').prop('href'),
                divs = $item.find('div');
            var mail = {
                _id: mailDetailUrl.match(/\d+/g)[0],
                title: $(divs[0]).text().trim(),
                sender: $(divs[1]).text().trim(),
                receiveUnit: $(divs[2]).text().trim(),
                status: $(divs[3]).text().trim(),
                category: $(divs[4]).text().trim(),
                views: $(divs[5]).text().trim()
            };

            new UrlCrawler('http://12345.chengdu.gov.cn/' + mailDetailUrl).startCrawl(($) => {// crawl mail detail
                mail.content = $($('.rightside1 td.td2')[1]).text().trim();
                mail.result = $('.rightside1 tbody tr:last-child').text().trim();
                mail.publishDate = $($('.rightside1 td.td32')[0]).text().trim() || $($('.rightside1 td.td32')[1]).text().trim();

                console.log(mail._id);

                db.update({_id: mail._id}, mail, {upsert: true}, function (err, newDoc) {
                    if (err) {
                        throw err;
                    }
                });

                nextMail();
            });
        }, function done() {
            crawlNextPage();
            updater.updateProgress(Math.floor(page * 100 / totalPage));
        });
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
