'use strict'
const _ = require('lodash')
const MongoDB = require('mongodb')
const MongoClient = MongoDB.MongoClient
const genericPool = require('generic-pool')

let pool

const defaultOptions = {
  host: 'localhost',
  port: 27017,
  db: 'test',
  max: 100,
  min: 1
}

exports.init = (options) => {
  options = _.assign({}, defaultOptions, options)
  let mongoUrl = options.uri || options.url

  if (!mongoUrl) {
    if (options.user && options.pass) {
      mongoUrl = `mongodb://${options.user}:${options.pass}@{options.host}:${options.port}/${options.db}`
    } else {
      mongoUrl = `mongodb://${options.host}:${options.port}/${options.db}`
    }
  }
  pool = genericPool.createPool({
    create: () => MongoClient.connect(mongoUrl, {
      poolSize: 1,
      native_parser: true
    }),
    destroy: (client) => client.close()
  }, options)
}

exports.acquire = () => pool.acquire()
exports.release = (conn) => pool.release(conn)
