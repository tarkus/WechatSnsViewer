const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const http = require('http');
const https = require('https');
const shell = require('shelljs');
const xml2js = require('xml2js');
const crypto = require('crypto');
const FileType = require('file-type');

var dataDir = './data';
var jsonFile = dataDir + '/exported_sns.json';
var userDir = dataDir + '/{AUTHOR_ID}';
var dataDir = userDir + '/data';
var mediaDir = userDir + '/media';
var thumbDir = userDir + '/thumb';
var timelineDir = userDir + '/timeline';
var assetJSON = dataDir + '/asset.json';
var shareJSON = dataDir + '/share.json';
var timelineJSON = dataDir + '/timeline.json';

function getTime(timestamp){
  if (!timestamp) {
    var date = new Date();
  } else {
    var date = new Date(timestamp);
  }

  var year = date.getFullYear();
  var month = (date.getMonth() +1);
  var day = date.getDate();

  var hour = date.getHours();
  var minute = date.getMinutes();
  var second = date.getSeconds();

  return formateTime(year, month, day, hour, minute, second);
}

function formateTime(year, month, day, hour, minute, second){
  return makeDoubleDigit(year) + "-" +
         makeDoubleDigit(month) + "-" +
         makeDoubleDigit(day) + " " +
         makeDoubleDigit(hour) + ":" +
         makeDoubleDigit(minute) + ":" +
         makeDoubleDigit(second);
}

function makeDoubleDigit(x){
  return (x < 10) ? "0" + x : x;
}

var sns = fs.readFile(jsonFile, 'utf8', function(err, data) {
  if (err) throw err;

  sns = JSON.parse(data);

  var assetMap = {};
  var shareMap = {};
  var authorId = "";
  var timeline = [];

  var parsed = 0;

  var getFilePath = function(file) {
    if (file == "asset") {
      return assetJSON.replace("{AUTHOR_ID}", authorId);
    }
    if (file == "share") {
      return shareJSON.replace("{AUTHOR_ID}", authorId);
    }
    if (file == "timeline") {
      return timelineJSON.replace("{AUTHOR_ID}", authorId);
    }
  }

  var download = function() {
    var assetUrls = Object.keys(assetMap);

    var assetCounter = {
      total: assetUrls.length,
      fail: 0,
      download: 0,
      started: 0
    }

    console.log("Start downloading " + assetCounter.total + " files ... ");
    var fetch = function(url, next) {
      var assetPath = assetMap[url];

      m = http;
      if (url.indexOf('https') === 0) {
        m = https;
      }

      if (url.indexOf('http') !== 0) {
        url = "http://" + url;
      }

      shell.mkdir('-p', path.dirname(assetPath));

      m.get(url, function(res) {
        var extension = mime.extension(res.headers['content-type']);
        if (['mp4', 'gif', 'png'].includes(extension)) {
          assetPath = assetPath.replace(".jpg", "." + extension);
          assetMap[url] = assetPath;
        }
        var file = fs.createWriteStream(assetPath);
        res.pipe(file);
        res.on('end', () => {
          console.log("Done => " + url);
          assetCounter.download += 1;
          file.end(); 
          next();
        });
      }).on('error', (err) => {
        var file = fs.createWriteStream(assetPath);
        file.end(); 
        console.log("Fail => " + url);
        assetCounter.fail += 1;
        next();
      });
    }

    var next = function() {
      var url = assetUrls.pop();
      if (url) {
        fetch(url, next);
      } else {
        console.log(assetCounter);
      }
    }

    fetch(assetUrls.pop(), next);
  }

  console.log("Populating timeline data ...");
  for (var item of sns) {
    if (!authorId) {
      authorId = item.authorId;
      shell.mkdir("-p", dataDir.replace("{AUTHOR_ID}", authorId));
      shell.cp(jsonFile, dataDir.replace("{AUTHOR_ID}", authorId));
    }

    if (authorId != item.authorId) {
      throw("AuthorId not consistent!");
    }

    var getDetail = function(item) {
      var snsId = item.snsId;
      var mediaList = item.mediaList;
      var dateString = getTime(item.timestamp * 1000);
      var date = dateString.replace(/[-\s:]/g, "");

      item.mediaDetail = [];
      item.dateString = dateString;

      var getAssetPath = function(category, id) {
        var filename = id + ".jpg";
        if (category == "thumb") {
          return thumbDir.replace("{AUTHOR_ID}", authorId) + "/" + date.substr(0, 4) + "/" + date + "/" + filename;
        } 
        if (category == "media") {
          return mediaDir.replace("{AUTHOR_ID}", authorId) + "/" + date.substr(0, 4) + "/" + date + "/" + filename;
        }
      }

      xml2js.parseString(item.rawXML.replace('/\\"/g', '"'), (err, raw) => {
        var contentObject = raw.TimelineObject.ContentObject[0];

        // - for share link
        if (contentObject.title != '' && contentObject.contentUrl != '') {
          shareMap[snsId] = { 
            title: contentObject.title, 
            url: contentObject.contentUrl[0]
          };
        }

        if (contentObject.mediaList) {
          var fixed = 0;
          var added = 0;
          for (var media of contentObject.mediaList[0].media) {
            var detail = {
              id: media.id[0],
              url: media.url[0]._,
              thumbUrl: media.thumb[0]._,
            };

            item.mediaDetail.push(detail);

            if (contentObject.title != '' && contentObject.contentUrl != '') {
              // - add the thumb for share link if has one
              if (!shareMap[snsId].thumbUrl) {
                shareMap[snsId].thumbUrl = detail.thumbUrl;
              } else {
                throw("incompatible content");
              }

              if (shareMap[snsId].url && shareMap[snsId].url.indexOf("support.weixin.qq.com") > 0) {
                shareMap[snsId].url = detail.url;
                assetMap[detail.url] = getAssetPath("media", detail.id);
              }

              assetMap[detail.thumbUrl] = getAssetPath("thumb", detail.id);
            } else {
              assetMap[detail.url] = getAssetPath("media", detail.id); 
            }

            if (mediaList.includes(detail.url)) {
              fixed += 1;
            } else {
              added += 1;
            }
          }

          /* 
          // - test purpose
          if (mediaList.length != contentObject.mediaList[0].media.length) {
            console.log("left:", mediaList.length, "right:", contentObject.mediaList[0].media.length, "fixed:", fixed, "added:", added);
          }
          */
        }

        timeline.push(item);
        parsed += 1;

        if (parsed == sns.length) {
          fs.writeFileSync(getFilePath("asset"), JSON.stringify(assetMap));
          fs.writeFileSync(getFilePath("share"), JSON.stringify(shareMap));
          fs.writeFileSync(getFilePath("timeline"), JSON.stringify(timeline));
          generateText();
          generateHTML();
          download();
        }
      });
    };

    var generateText = function() {
      var yearly = {};
      var template = "###### {DATE} \n\n{CONTENT}\n\n";
      for (var entry of timeline) {
        var text = "";
        var content = "";
        var year = entry.dateString.substr(0, 4);
        var shareItem = shareMap[entry.snsId];
        if (shareItem) {
          if (shareItem.url.indexOf('sns.video.qq.com') > 0 || shareItem.url.indexOf('snsvideodownload') > 0) {
            var link = "[" + shareItem.title + "](" + assetMap[shareItem.url].replace(".jpg", ".mp4").replace("./data", "../data") + ")";   
          } else {
            var link = "[" + shareItem.title + "](" + shareItem.url + ")";   
          }
          content = [entry.content, link].join("\n\n");
        } else {
          var images = [];
          for (var i = 0;i < entry.mediaDetail.length;i++) {
            var media = entry.mediaDetail[i];
            var image = "![" + (i + 1) + "](" + assetMap[media.url].replace("./data", "../data") + ")";
            images.push(image);
          }

          content = [entry.content, images.join("\n")].join("\n\n");
        }
        var text = template.replace("{DATE}", entry.dateString).replace("{CONTENT}", content);
        if (!yearly[year]) {
          yearly[year] = [];
        }
        yearly[year].push(text);
      }

      for (var year in yearly) {
        var filename = timelineDir.replace("{AUTHOR_ID}", authorId) + "/" + year + ".txt";
        shell.mkdir('-p', path.dirname(filename));
        fs.writeFileSync(filename, yearly[year].join("\n"));
      }
    }

    var generateHTML = function() {
      shell.rm('-rf', userDir.replace("{AUTHOR_ID}", authorId) + "/assets");
      shell.cp('-r', "./assets", userDir.replace("{AUTHOR_ID}", authorId) + "/assets");
      var yearly = {};
      var template = fs.readFileSync("./index.html", "utf8");

      var find = [
        '朋友圈存档',
        '<script src="./assets/js/app.js"></script>',
        '<link href="./assets/css/app.css" rel="stylesheet">',
        'var authorId = null;', 
        'var timeline = null;', 
        'var assetMap = null;', 
        'var shareMap = null;', 
        'var waypoint = 0;'
      ];

      for (var entry of timeline) {
        var year = entry.dateString.substr(0, 4);
        if (!yearly[year]) {
          yearly[year] = [];
        }
        yearly[year].push(entry);
      }

      for (var year in yearly) {
        var html = template;
        var regex = new RegExp('./data/[^/]+/', 'g');
        var replace = [
          '朋友圈存档 - ' + year + "年",
          '<script src="../assets/js/app.js"></script>',
          '<link href="../assets/css/app.css" rel="stylesheet">',
          'var authorId = "' + authorId + '";', 
          'var timeline = ' + JSON.stringify(yearly[year]) + ';', 
          'var assetMap = ' + JSON.stringify(assetMap).replace(regex, "../") + ';', 
          'var shareMap = ' + JSON.stringify(shareMap) + ';', 
          'var waypoint = -1;'
        ];

        for (var i = 0; i < find.length; i++) {
          html = html.replace(find[i], replace[i]);
        }

        var filename = timelineDir.replace("{AUTHOR_ID}", authorId) + "/" + year + ".html";
        shell.mkdir('-p', path.dirname(filename));
        fs.writeFileSync(filename, html);
      }

      // - index.html
      var html = template;
      var regex = new RegExp('./data/[^/]+/', 'g');
      var replace = [
        '朋友圈存档',
        '<script src="./assets/js/app.js"></script>',
        '<link href="./assets/css/app.css" rel="stylesheet">',
        'var authorId = "' + authorId + '";', 
        'var timeline = ' + JSON.stringify(timeline) + ';', 
        'var assetMap = ' + JSON.stringify(assetMap).replace(regex, "./") + ';', 
        'var shareMap = ' + JSON.stringify(shareMap) + ';', 
        'var waypoint = 0;'
      ];

      for (var i = 0; i < find.length; i++) {
        html = html.replace(find[i], replace[i]);
      }

      var filename = userDir.replace("{AUTHOR_ID}", authorId) + "/index.html";
      shell.mkdir('-p', path.dirname(filename));
      fs.writeFileSync(filename, html);

    }

    getDetail(item);
  }
});


