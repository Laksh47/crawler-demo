var gplay = require('gpapi');
var fs = require("fs");

var myFile = fs.createWriteStream("test.apk");

var api = gplay.GooglePlayAPI({
	username: "scrawler16.9@gmail.com",
	password: "softwarearchitecturegroup",
	androidId: "3fddcb51d78c34da"
	// apiUserAgent: optional API agent override (see below)
	// downloadUserAgent: optional download agent override (see below)
});

docid = "air.com.differencegames.hospringcleaningfree"
version = "1000100"

api.download(docid, version).then(function (res) {
	console.log("Starting:"+ docid);
	res.pipe(myFile);

	res.on('end', () => {
		console.log("finished:" + docid);
		myFile.end();
	});

	res.on('error', () => {
		console.log("Error downloading:" + docid);
		myFile.end();
	});
}, function (err) {
  console.error(err.toString());
});