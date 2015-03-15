
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};

/*
http://cache.video.qiyi.com/vms?
key=fvip&src=1702633101b340d8917a69cf8a4b8c7c
&tvId=340554300
&vid=589cba04c65b5b320193946fa76d2c87
&vinfo=1&tm=1788
&enc=3150cbe0a0132ba5e5005518c248d497
&qyid=a45ab14b55eb92ed3bb9380e4cd7382b
&puid=2095239297
&authKey=8ef3b162cc5b11a0173a1caa982ba987
&um=1&tn=0.7034460180439055
*/
/*
http://cache.video.qiyi.com/vms?
key=fvip&src=1702633101b340d8917a69cf8a4b8c7c
&tvId=340554300
&vid=589cba04c65b5b320193946fa76d2c87
&vinfo=1&tm=3607
&enc=ed132d8738949804567b066647277a3b
&qyid=a45ab14b55eb92ed3bb9380e4cd7382b
&puid=2095239297
&authKey=dd9624a2c75058c1d16832d063b96da8
&um=1&tn=0.8383389790542424
*/

var iqiyi = (function() {
	function iqiyi(uid, ukey) {
		this.uid = uid;
		this.ukey = ukey;
	}
	iqiyi.prototype._req = function(url, param, cb) {
		if(param) {
			var _p = [];
			for(k in param) {
				_p.push(k + '=' + param[k]);
			}
			url += '?' + _p.join('&');
		}
		var yql = 'select * from json where url="' + url + '"';
		var yqlurl = 'https://query.yahooapis.com/v1/public/yql?format=json&env=store%3A%2F%2Fdatatables.org%2Falltableswithkeys&diagnostics=true&q=' + encodeURIComponent(yql);
		console.log(url);
		//console.log(yqlurl);
		$.ajax({
			type: 'GET',
			url: yqlurl,
			dataType: 'json',
			crossDomain: true,
			success: function(d) {
				//console.log(d);
				if(d.query.results)
					if(cb) cb(d.query.results.json);
			},
		});
	};
	iqiyi.prototype._uuid = function() {
		function s4() {
			return Math.floor((1 + Math.random()) * 0x10000)
				.toString(16)
				.substring(1);
		}
		return s4() + s4() + s4() + s4() + s4() + s4() + s4() + s4();
	};
	iqiyi.prototype._vms = function(tvid, vid, cb) {
		var tm = (Math.floor(Math.random() * (1000 - 100)) + 100).toString();
		var param = {
			key: "fvip",
			src: "1702633101b340d8917a69cf8a4b8c7c",
			tvId: tvid,
			vid: vid,
			vinfo: 1,
			tm: tm,
			enc: YaMD5.hashStr('ts56gh'+ tm + tvid),
			um: 1,
			//qyid: this._uuid(),
			//authkey: YaMD5.hashStr(''+ tm + tvid),
			//tn: Math.random().toString(),
		};
		this._req('http://cache.video.qiyi.com/vms', param, cb);
	};
	iqiyi.prototype._decodeframe = function(src) {
		var dst = src.split('-');
		dst = dst.map(function(a, i){
			var s = parseInt(a, 16);
			switch(i % 3) {
				case 1:
					s ^= 72;
					break;
				case 2:
					s ^= 121;
					break;
				default:
					s ^= 103;
			}
			return String.fromCharCode(s);
		});
		return dst.reverse().join('');
	};
	iqiyi.prototype._time = function(cb, info) {
		this._req('http://data.video.qiyi.com/t', null, function(d) {
			if(cb) cb(info, Math.floor(d.t/600));
		});
	};
	iqiyi.prototype._mp4info = function(cb, info, t) {
		this.title = info.data.vi.vn;
		this.videos = {};
		var baseurl = info.data.vp.du.split('/');
		var vs = info.data.vp.tkl.vs;
		for(var i = 0; i < vs.length; i++) {
			var bid = vs[i].bid;
			var fs = vs[i].fs
			var frames = [];
			for(var j = 0; j < fs.length; j++) {
				var _path = fs[j].l[0] == '/' ? fs[j].l : this._decodeframe(fs[j].l);
				var _key = _path.split('/').slice(-1)[0].split('.')[0];
				var _url = baseurl.slice(0, -1).concat([YaMD5.hashStr(t + ')(*&^flash@#$%a' + _key)]).concat(baseurl.slice(-1)).join('/') + _path;
				frames.push({
					msz: fs[j].msz,
					url: _url,
				});
			}
			this.videos[bid] = frames;
		}
		if(cb) cb();
	};
	iqiyi.prototype._mp4urls = function(bid, idx, cb) {
		var arr = this.videos[bid];
		if(idx < arr.length) {
			this._req(arr[idx].url, null, (function(d) {
				arr[idx].raw = d.l;
				this._mp4urls(bid, idx + 1, cb);
			}).bind(this));
		} else {
			if(cb) cb(arr);
		}
	};
	iqiyi.prototype.load = function(tvid, vid, cb) {
		this._vms(tvid, vid, this._time.bind(this, this._mp4info.bind(this, cb)));
	};
	iqiyi.prototype.loadraw = function(tvid, vid, bid, cb) {
		this.load(tvid, vid, this._mp4urls.bind(this, bid, 0, cb));
	};
	return iqiyi;
})();

foo = new iqiyi;
foo.loadraw('340554300', '589cba04c65b5b320193946fa76d2c87', '5', function(a){
	var raws = a.map(function(e){return e.raw});
	//console.log(raws);
	var main = $('<div>');
	/*var playlist = [];*/
	for(var i = 0; i < raws.length; i++) {
		var _v = $('<video>').attr({
			id: 'v'+i,
			width: 800,
			height: 522,
			
		}).append($('<source>').attr({
			src: raws[i],
			type: "video/mp4",
		}));;
		if(i>0) _v.css('display', 'none');
		main.append(_v);
		playlist.push({
			"video": _v[0],
		})
	}
	/*main.append($('<div id="load-player">'))*/
	$('body').append(main);
	/*ABP.create(document.getElementById("load-player"), {
		"src":{
			"playlist":playlist
		},
		"width":800,
		"height":522
	});*/
	/*$('body').append($('<a href="#">').text('Play').addClass('jp-play'));
	$("#load-player").jPlayer({
        ready: function(event) {
            $(this).jPlayer("setMedia", {
				title: "Bubble",
				m4v: raws[0],
            });
        },
        swfPath: "http://jplayer.org/latest/dist/jplayer",
        supplied: "m4v",
		wmode: "window",
		useStateClassSkin: true,
		autoBlur: false,
		smoothPlayBar: true,
		keyEnabled: true,
		remainingDuration: true,
		toggleDuration: true
    });*/
});
