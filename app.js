'use strict'
const Koa = require('koa')
const mount = require('koa-mount')
const config = require('./config')

const mongoOpts = {
  host: config.mongo.host,
  max: 5,
  min: 1,
  timeout: 30000,
  logout: false
}

// init the connection pool
require('./db/connectionMgr').init(mongoOpts)

// Create the main application
const app = new Koa()

async function setTenant (ctx, next) {
  const domain = ctx.subdomains[4]
  ctx.tenant = domain || 'default'
  await next()
}

app.use(setTenant)

// Create a koa application for v1 services
const v1 = new Koa()
v1.use(require('./services').v1)

// mount the v1 app as a middleware in the
// main app
app.use(mount('/api/v1', v1))
module.exports = app
