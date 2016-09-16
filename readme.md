# 使用Electron构建跨平台的抓取桌面程序

谈起桌面应用开发技术, 目前的主流开发技术有.Net下的WinForm, Java下的JavaFX以及Linux下的QT. 如果Web应用程序员想做桌面程序怎么办? 对于Web应用程序员来说, 大多都擅长后端的Java,NodeJs和前端的Javascript, 传统桌面应用技术的学习曲线不低, 上手比较困难. 而Electron的出现给我们这些Web应用程序员带来了福音.

Electron简介:
> Electron 是 Github 发布跨平台桌面应用开发工具，支持 Web 技术开发桌面应用开发，其本身是基于 C++ 开发的，GUI 核心来自于 Chrome，而 JavaScript 引擎使用 v8...

简单的说, 做Electron开发就是用Javascript把UI和后台逻辑打通, 后台主进程使用NodeJs提供丰富的API完成逻辑, UI借助Chrome控件或者渲染html完成交互.  

我之前基于SpringBoot开发了一套[市长信箱抓取Web应用][1]. 由于没服务器部署, 我现在想把同样的功能移植到桌面端, 作成一个桌面应用. 这个应用最好是跨平台, 能编译成为Mac下的DMG安装程序, 同时也能编译成windows平台下的exe文件, 满足不足场景的使用. Electron作为开发平台正好能满足我的这些需求, 通过一天的摸索, 我完成了这个桌面应用, 并最终打包出Mac平台下的DMG安装文件.   

下面我介绍一下我是如何使用Electron开发这个抓取应用.

### 市长信箱邮件抓取Web应用
动手之前, 我先分析一下之前的Web应用. 它的架构如下:
![逻辑图](./docs/springboot.png)
应用分可为四部分:
1. 抓取程序:使用Java的OkHttp作为Http请求类库获取网页内容,并交给Jsoup进行解析, 得到邮件内容.
2. 数据库:用Mysql实现, 用来保存抓取后的网页内容, 并提供检索查询服务.
3. 静态交互页面:一个简单的HTML页面, 使用jQuery发起ajax与后端交互, 并使用handlebar作为展示模板.
4. 通信: 使用SpringBoot提供了交互需要的API: 搜索服务,全量抓取和更行邮件.

### 使用Electron构建抓取桌面应用
对于我将要实现的桌面应用, 同样也需要需要完成这四部分的工作. 我做了一下规划:  
Electron主进程借助NodeJs丰富的生态系统完成网页抓取与数据存储与搜索的功能, UI进程则完成页面的渲染工作.

1. 抓取程序: 使用NodeJs的request, cheerio, async完成.
2. 数据库: 使用NodeJs下的nedb存储, 它作为应用内嵌数据库可以方便的集成.
3. UI: 使用HTML与前端JavaScript类库完成, 重用之前Web应用中的静态页面.
4. 通信: 使用Electron提供的IPC,完成主进程与UI进程的通信.  

设计桌面应用的内部实现如下:
![逻辑图](./docs/watcher.png)

下面分别对着四部分做介绍:

#### 抓取程序
我们抓取的市长信箱邮件多达上万封, 利用JavaScript异步编程的特性很容易写出上千并发抓取的程序, 现实中这会造成两个问题:
1. tcp端口被耗尽
2. 抓取目标服务器拒绝服务  

都会造成抓取流程失败. 所以抓取程序要做到:   
1. tcp连接复用  
2. 并发频率可控  

我这里一下三个NodeJs组件:  
1. [Request][2]: http客户端, 利用了底层NodeJs的Http KeepAlive特性实现了tcp连接的复用.   
2. [async][4]:   控制请求的并发以及异步编程的顺序性.  
3. [cheerio][3]: html的解析器.  
代码示例:
```JavaScript
//使用request获取页面内容
request('http://12345.chengdu.gov.cn/moreMail', (err, response, body) => {
    if (err) throw err;
    //使用cheerio解析html
    var $ = cheerio.load(body),
        totalSize = $('div.pages script').html().match(/iRecCount = \d+/g)[0].match(/\d+/g)[0];
    ......
    //使用async控制请求并发, 顺序的抓取邮件分页内容
    async.eachSeries(pagesCollection, function (page, crawlNextPage) {
        pageCrawl(page, totalPageSize, updater, crawlNextPage);
    })
});
```

#### 数据库
抓取后的内容存储方式有较多选择:  
1. 文本文件
2. 搜索引擎
3. 数据库  

文本文件虽然保存简单, 但不利于查询和搜索, 顾不采用.  
搜索引擎一般需要独立部署, 不利于桌面应用的安装, 这里暂不采用.  
独立部署的数据库有和搜索引擎同样的问题, 所以像连接外部Mysql的方式这里也不采用. 我们需要一种内嵌数据库.

幸好NodeJs的组件异常丰富, [nedb][5]是一种理想方案, 它是一个可将数据同时保存在内存和磁盘的文档型内嵌数据库, 使用mongodb的语法进行数据操作.代码示例:
```JavaScript
//建立数据库连接
const db = new Datastore({filename: getUserHome()+'/.electronapp/watcher/12345mails.db', autoload: true});
......
//使用nedb插入数据
db.update({_id: mail._id}, mail, {upsert: true}, function (err, newDoc) {});
......
//使用nedb进行邮件查询
let match = {$regex: eval('/' + keyword + '/')}; //关键字匹配
var query = keyword ? {$or: [{title: match}, {content: match}]} : {};
db.find(query).sort({publishDate: -1}).limit(100).exec(function (err, mails) {
    event.sender.send('search-reply', {mails: mails});//处理查询结果
});
```


#### UI

#### 通信

### 将Electron桌面应用打包成安装程序



### Run

```
$ npm install && npm start
```

### Build

```
$ npm run build
```

[1]: https://segmentfault.com/a/1190000005183675
[2]: https://github.com/request/request
[3]: https://github.com/cheeriojs/cheerio
[4]: https://github.com/caolan/async
[5]: https://github.com/louischatriot/nedb
[6]: https://github.com/electron-userland/electron-builder
