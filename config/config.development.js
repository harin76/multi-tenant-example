'use strict'

const config = require('./config.global')

config.env = 'development'
config.mongo.dbName = config.mongo.dbName + '_dev'

module.exports = config
