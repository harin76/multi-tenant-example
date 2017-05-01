'use strict'

const Router = require('koa-router')
const router = new Router()

require('./tasks').register(router)

module.exports = router.middleware()
