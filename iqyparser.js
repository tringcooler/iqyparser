
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};

var iqiyi = (function() {
	function iqiyi(uid, ukey) {
		this.uid = uid;
		this.ukey = ukey;
	}
	iqiyi.prototype._req = function(url, param, cb, retry) {
		if(!retry) {
			if(retry == 0) throw 'Request failed.';
			else retry = 5;
		}
		var tryagain = this._req.bind(this, url, param, cb, retry-1);
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
				if(d.query.results) {
					if(cb) cb(d.query.results.json);
				} else
					tryagain();
			},
			error: tryagain,
		});
	};
	iqiyi.prototype._reqpage = function(url, cb, retry) {
		if(!retry) {
			if(retry == 0) throw 'Request failed.';
			else retry = 5;
		}
		var tryagain = this._reqpage.bind(this, url, cb, retry-1);
		var yql = 'select * from html where url="' + url + '"';
		var yqlurl = 'https://query.yahooapis.com/v1/public/yql?format=xml&env=store%3A%2F%2Fdatatables.org%2Falltableswithkeys&diagnostics=true&q=' + encodeURIComponent(yql);
		//console.log(url);
		console.log(yqlurl);
		$.ajax({
			type: 'GET',
			url: yqlurl,
			dataType: 'xml',
			crossDomain: true,
			success: function(d) {
				//console.log(d);
				if(/*d.children[0].children[1].children.length*/ $('results', d).children().length == 0)
					tryagain();
				else {
					var _v = $('[data-player-tvid]', d);
					if(cb) cb(_v.attr('data-player-tvid'), _v.attr('data-player-videoid'));
				}
			},
			error: tryagain,
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
			qyid: this._uuid(),
			authkey: YaMD5.hashStr(''+ tm + tvid),
			tn: Math.random().toString(),
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
					b: fs[j].b,
					d: fs[j].d,
					url: _url,
				});
			}
			this.videos[bid] = frames;
		}
		if(cb) cb();
	};
	iqiyi.prototype._mp4urls = function(bids, idx, cb) {
		if(!(bids instanceof Array)) bids = [bids];
		var bid = bids[0];
		var arr = this.videos[bid];
		if(!arr) {
			bids.shift();
			this._mp4urls(bids, 0, cb);
		} else {
			if(idx < arr.length) {
				this._req(arr[idx].url, null, (function(d) {
					arr[idx].raw = d.l;
					this._mp4urls(bids, idx + 1, cb);
				}).bind(this));
			} else {
				if(cb) 
					if(cb(arr, bid, this)) return;
				if(bids.length > 1) {
					bids.shift();
					this._mp4urls(bids, 0, cb);
				}
			}
		}
	};
	iqiyi.prototype.loadinfo = function(tvid, vid, cb) {
		this._vms(tvid, vid, this._time.bind(this, this._mp4info.bind(this, cb)));
	};
	iqiyi.prototype.loadraw = function(tvid, vid, bid, cb) {
		this.loadinfo(tvid, vid, this._mp4urls.bind(this, bid, 0, cb));
	};
	iqiyi.prototype.loadpage = function(url, bids, cb) {
		this._reqpage(url, (function(tvid, vid){
			this.loadraw(tvid, vid, bids, cb);
		}).bind(this));
	};
	return iqiyi;
})();



$(document).ready(function() {
	
	var listraws = function(arr, bid, i) {
		var raws = arr.map(function(e){return e.raw});
		var bidtxt = bid;
		if(bid == 5) bidtxt = '1080p';
		else if(bid == 4) bidtxt = '720p';
		var ttltxt = i.title;
		for(var i = 0; i < raws.length; i++) {
			var fmtxt = '(' + [arr[i].b, arr[i].d, arr[i].msz].join(', ') + '): ';
			$('body').append($('<a>').attr('href', raws[i]).append($('<p>').text(ttltxt + fmtxt + bidtxt + '-' + i)));
		}
		if(bid <= 4) return true;
	}
	
	iq = new iqiyi;
	if(location.hash) {
		iq.loadpage(location.hash.slice(1), [5,4,2,1], listraws);
	}
});
