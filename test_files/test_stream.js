var fs = require("fs");

argv = process.argv[2]

console.log(argv);


fs.exists(argv, (exists) => {
	if(!exists) {
		console.log('not exists');
		var myFile = fs.createWriteStream("test.apk");
	} else {
		console.log('exists')
	}
})

// setTimeout(function() {
// 	fs.unlinkSync("test.apk")
// }, 5000);