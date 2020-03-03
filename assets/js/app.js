function formatTime(timestamp) {
  var date = new Date(timestamp * 1000);
  return date.toLocaleString("zh-CN");
}

var appendEntries = function(entries, callback) {
  entries.forEach( entry => {
    var snsId = entry.snsId;
    var authorName = entry.authorName;
    var content = entry.content;
    var date = entry.dateString;
    var mediaDetail = entry.mediaDetail;
    var snsContainer = $("<div/>", {class: "snsContainer"});
    var imagesContainer = $("<div/>", {class: "imagesContainer"});
    $("<div/>", {class: "content"}).text(content).appendTo(snsContainer);
    var shareItem = shareMap[snsId];
    if (shareItem) {
      var linkContainer = $("<div/>", {class: "linkContainer"}).appendTo(snsContainer);
      var thumb = $("<img/>", {class: "thumb"})
        .attr('src', assetMap[shareItem.thumbUrl])
        .appendTo(linkContainer);
      if (shareItem.url.indexOf('sns.video.qq.com') > 0 || shareItem.url.indexOf('snsvideodownload') > 0) {
        var link = $("<a/>", {class: "link"})
          .attr('data-fancybox', 'gallery')
          .attr('href', assetMap[shareItem.url].replace(".jpg", ".mp4"))
          .text(shareItem.title)
          .appendTo(linkContainer);
      } else {
        var link = $("<a/>", {class: "link"})
          .attr('href', shareItem.url)
          .attr('target', "_blank")
          .text(shareItem.title)
          .appendTo(linkContainer);
        }
    } else {
      mediaDetail.forEach( detail => {
        var imgContainer = $("<a/>", {class: "imgContainer"});
        var localUrl = assetMap[detail.url];
        imgContainer
          .attr('data-fancybox', 'gallery')
          .attr('data-caption', detail.content)
          .attr('href', localUrl);
        $("<div/>", {class: "media"})
          .css('background-image', "url('" + localUrl + "')")
          .appendTo(imgContainer);
        imgContainer.appendTo(imagesContainer);
      });
    }
    imagesContainer.appendTo(snsContainer);
    //$("<div/>", {class: "authorName"}).text("by " + authorName).appendTo(snsContainer);
    $("<div/>", {class: "timestamp"}).text(date).appendTo(snsContainer);
    snsContainer.appendTo("#app");
  });

  if (waypoint >= 0) {
    waypoint += scrollAmount;
  }
}

var loadJSON = function(callback) {
  if (timeline) {
    return callback();
  }

  $.getJSON("./data/exported_sns.json", function (entries) {
    if (!entries[0]) {
      return;
    }
    // get authorId
    authorId = entries[0].authorId;
    $.getJSON("./data/" + authorId + "/data/timeline.json").then( function (timelineJSON) {
      $.getJSON("./data/" + authorId + "/data/share.json").then( function (shareJSON) {
        $.getJSON("./data/" + authorId + "/data/asset.json", function (assetJSON) {
          timeline = timelineJSON;
          shareMap = shareJSON;
          assetMap = assetJSON;
          callback();
        });
      });
    });
  });
}

var getEntries = function() {
  return timeline.slice(waypoint, waypoint + scrollAmount);
}

var init = function() {
  loadJSON(function() {
    if (waypoint < 0) {
      return appendEntries(timeline);
    }

    appendEntries(getEntries());
    $(window).scroll(function () {
      if ($(window).scrollTop() >= $(document).height() - $(window).height() - 180) {
        appendEntries(getEntries());
      }
    });

  });
}
