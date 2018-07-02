
var gplay = require('google-play-scraper');

gplay.app({appId: 'air.bigbadquiz', lang: 'en'})
  .then(console.log, console.log);