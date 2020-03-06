var searchText = null;
var searchResult = null;
var monthlyPosts = null;
var fuseSearch = null;
var currentView = "#posts";
var viewState = {
  "#posts": { cursor: 0 },
  "#stats": { cursor: 0 },
  "#search-result": { cursor: 0 },
  "#archive": { cursor: 0 },
};
var dateTags = {};
var stats = {
  since: "",
  until: "",
  posts: 0,
  media: 0,
  likes: 0,
  comments: 0,
  active_months: [] 
};

var formatTime = function(timestamp) {
  var date = new Date(timestamp * 1000);
  return date.toLocaleString("zh-CN");
}

var emoji = [
  "微笑","撇嘴","色","发呆","得意","流泪","害羞","闭嘴","睡","大哭","尴尬","发怒","调皮","呲牙","惊讶","难过","囧","抓狂","吐","偷笑",

  "愉快","白眼","傲慢","困","惊恐","流汗","憨笑","悠闲","奋斗","咒骂","疑问","嘘","晕","衰","骷髅","敲打","再见","擦汗","抠鼻","鼓掌",

  "坏笑","左哼哼","右哼哼","哈欠","鄙视","委屈","快哭了","阴险","亲亲","可怜","菜刀","西瓜","啤酒","咖啡","猪头","玫瑰","凋谢","嘴唇","爱心","心碎",

  "蛋糕","炸弹","便便","月亮","太阳","拥抱","强","弱","握手","胜利","抱拳","勾引","拳头","OK","跳跳","发抖","怄火","转圈","高兴","口罩",

  "笑哭","吐舌头","傻呆","恐惧","悲伤","不屑","嘿哈","捂脸","奸笑","机智","皱眉","耶","鬼脸","合十","加油","庆祝","礼物","红包","鸡"
]

var replaceEmoji = function(text) {
  if (!text) {
    return;
  }
  var find = [];
  var replace = [];
  var regex = new RegExp().compile(/\[(.{1,3})\]/g);
  var matched = text.match(regex);
  if (matched) {
    var t = matched[0];
    if (emoji.includes(t.substr(1, t.length - 2))) {
      return text.replace(regex, '<i class="emoji" style="background-image: url(' + assetPath + '/emoji/$1.png)"></i>');
    }
  }
  return text;
}

var getPosts = function(collection) {
  var slice = [];
  if (collection) {
    var data = collection;
  } else {
    if (currentView == '#posts') {
      var data = timeline;
    } else if (currentView == '#archive') {
      var data = monthlyPosts;
    } else if (currentView == '#search-result') {
      var data = searchResult;
    }
  }

  var start = viewState[currentView].cursor;
  var end = viewState[currentView].cursor + scrollAmount;

  if (data) {
    var slice = data.slice(start, end);
    if (slice.length > 0) {
      viewState[currentView].cursor += scrollAmount;
    }
  } 

  return slice;
}

var appendPosts = function(posts) {
  if (currentView == '#search-result') {
    if (posts.length == 0) {
      if ($("#search-result .snsContainer").length == 0) {
        $(currentView).html($("#templates .empty").html());
      }

      $('.posts-toggle').on('click', function() {
        switchView("#posts");
      });
    } else {
      var reportHTML = $("#templates .search-report").html()
      reportHTML = reportHTML.replace('{needle}', searchText);
      reportHTML = reportHTML.replace('{result}', searchResult.length);
      $(currentView).html(reportHTML);
    }
  } 

  var timelineDate = null;
  var timelineYear = null;
  posts.forEach(post => {
    var snsId = post.snsId;
    var authorName = post.authorName;
    var content = replaceEmoji(post.content);
    var date = post.dateString;
    var year = date.substr(0, 4);
    var month = date.substr(5, 2).replace(/^0/, "");
    var day = date.substr(8, 2);
    var dateShort = date.substr(0, 10);
    var showDate = false;
    var mediaDetail = post.mediaDetail;
    var snsContainer = $("<div/>", {class: "snsContainer"});
    var imagesContainer = $("<div/>", {class: "imagesContainer"});
    $("<div/>", {class: "content"}).html(content).appendTo(snsContainer);

    if (timelineYear != year) {
      timelineYear = year;
    }

    if (timelineDate != dateShort) {
      showDate = true;
      timelineDate = dateShort;
    }
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
    var row = $("<div/>", {class: "row"});
    var dateTag = $("<div/>", {class: "date-tag"});
    if (showDate) {
      $(dateTag).html('<span class="date-day text-muted">' + day + '</span>' +
        '<span class="date-month text-muted">' + month + '月</span>').appendTo(dateTag);
    }
    var col = $("<div/>", {class: "col-md-8 offset-md-2"}).appendTo(row);
    dateTag.prependTo(snsContainer);
    snsContainer.appendTo(col);
    row.appendTo($(currentView));
  });
  $.busyLoadFull("hide");
  $(currentView).trigger('ready');
}

var generateStats = function() {
  stats.until = timeline[0].dateString.substr(0, 10);
  var years = [];
  timeline.forEach((post, idx) => {
    stats.media += post.mediaDetail.length;
    stats.comments += post.comments.length;
    stats.likes += post.likes.length;
    var year = post.dateString.substr(0, 4);
    var month = post.dateString.substr(0, 7);
    if (!years.includes(year)) {
      years.push(year);
    }
    if (typeof dateTags[month] == 'undefined') {
      dateTags[month] = { count: 0, start: idx }
    }
    dateTags[month].count += 1;
  });
  var monthStats = [];
  for (var month in dateTags) {
    monthStats.push([month, dateTags[month].count]);
  }
  stats.active_months = monthStats.sort((a, b) => (a[1] < b[1]) ? 1 : -1);
  stats.since = timeline[timeline.length - 1].dateString.substr(0, 10);
  stats.posts = timeline.length;

  // build the date panel
  var panelYearHTML = '<li class="dropdown-submenu"><a class="dropdown-item dropdown-toggle" href="#">{year}年</a><ul class="dropdown-menu">{submenu}</ul></li>';
  var panelMonthHTML = '<li><a class="dropdown-item archive-toggle {disabled}" href="#" data-month="{yearmonth}" {disabled}>{month}</a></li>';
  var monthName = [
    "一月", "二月", "三月", "四月", "五月", "六月", 
    "七月", "八月", "九月", "十月", "十一月", "十二月"
  ];
  var panelYearList = [];
  for (var year of years) {
    var panelYearString = '';
    var panelMonthString = '';
    var panelMonthList = [];
    panelYearString = panelYearHTML.replace(/\{year\}/g, year);  
    monthName.forEach((name, idx) => {
      var x = idx + 1;
      var month = (x < 10) ? "0" + x : x.toString()
      var yearmonth = year + "-" + month;
      panelMonthString = panelMonthHTML.replace("{yearmonth}", yearmonth);
      panelMonthString = panelMonthString.replace("{month}", name);
      if (dateTags[yearmonth]) {
        panelMonthString = panelMonthString.replace(/\{disabled\}/g, "");
      } else {
        panelMonthString = panelMonthString.replace(/\{disabled\}/g, "disabled");
      }
      panelMonthList.push(panelMonthString);
    });
    panelYearList.push(panelYearString.replace("{submenu}", panelMonthList.join("")));
  }
  $("#date-panel").html(panelYearList.join(""));

  $('.dropdown-menu a.dropdown-toggle').on('click', function(e) {
    if (!$(this).next().hasClass('show')) {
      $(this).parents('.dropdown-menu').first().find('.show').removeClass('show');
    }
    var $subMenu = $(this).next('.dropdown-menu');
    $subMenu.toggleClass('show');


    $(this).parents('li.nav-item.dropdown.show').on('hidden.bs.dropdown', function(e) {
      $('.dropdown-submenu .show').removeClass('show');
    });


    return false;
  });


  // build view too
  var monthString = '';
  var topMonths = stats.active_months.slice(0, 3);
  topMonths.forEach(m => {
    monthString += '<a class="archive-toggle card-link" href="#" data-month="' + m[0] + '">' + m[0].replace("-", "年") + '月' + '</a>';
  });
  var wordArtValue = wordArtURL ? wordArtURL : assetMap["WORD_ART_URL"];
  var shasumValue = shasum ? shasum : assetMap["SHASUM"];
  var wordArt = '<img src="' + wordArtValue + '">';
  
  var vars = ['{since}', '{until}', '{months}', '{posts}', '{comments}', '{likes}', '{media}', '{word_art}', '{shasum}'];
  var values = [stats.since, stats.until, monthString, stats.posts, stats.comments, stats.likes, stats.media, wordArt, shasumValue];
  var html = $("#templates .stats").html();
  for (var i = 0; i < vars.length; i++) {
    html = html.replace(vars[i], values[i]);
  }
  $("#stats").html(html);
}

var loadJSON = function(callback) {
  if (timeline) {
    return callback();
  }

  $.getJSON("./data/exported_sns.json", function (posts) {
    if (!posts[0]) {
      return;
    }
    // get authorId
    authorId = posts[0].authorId;
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

var switchView = function(view) {
  currentView = view;
  $(window).unbind('scroll');
  if (currentView != "#search-result") {
    $(".search-input").val("");
    searchText = null;
  }
  if (currentView == '#archive' || currentView == '#search-result') {
    $(currentView).empty();
    viewState[currentView].cursor = 0;
    $(document).scrollTop(-1);
    appendPosts(getPosts());
  } else {
    $(currentView).trigger('ready');
  } 
}

var init = function() {
  $.busyLoadSetup({ animation: "slide" });
  $.busyLoadFull("show");

  loadJSON(function() {
    generateStats();
    fuseSearch = new Fuse(timeline, {
      shouldSort: true,
      caseSensitive: false,
      threshold:0.1,
      keys: ["content", "shareTitle"],
    });

    if (waypoint < 0) {
      return appendPosts(timeline);
    }

    appendPosts(getPosts());

    $('.view').on('ready', function() {
      $(".view").removeClass("active");
      $(currentView).addClass("active");

      $(window).scroll(function () {
        if ($(window).scrollTop() >= $(document).height() - $(window).height() - 180) {
          if ($(currentView).hasClass("posts")) {
            appendPosts(getPosts());
          }
        }
      });
    });

    $(".search-form").submit(function(event) {
      event.preventDefault();
      searchText = $(".search-input").first().val();
      if (!searchText) {
        return;
      }

      $.busyLoadFull("show");
      searchResult = fuseSearch.search(searchText);
      switchView("#search-result");
    });

    $('.archive-toggle').on('click', function() {
      var month = $(this).data('month');
      var start = dateTags[month].start;
      var end = dateTags[month].start + dateTags[month].count;
      monthlyPosts = timeline.slice(start, end);
      switchView("#archive");
    });

    $('.posts-toggle').on('click', function() {
      switchView("#posts");
    });

    $('.stats-toggle').on('click', function() {
      switchView("#stats");
    });

    $("#posts").trigger('ready');
  });
}
