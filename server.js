'use strict'

const config = require('./config')
const app = require('./app')

app.listen(config.app.port, function () {
  console.log('services started at ' + config.app.port)
})
