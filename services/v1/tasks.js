'use strict'
const koaBody = require('koa-body')()
const to = require('await-to-js').default
const Task = require('../../models/task')

const create = async function (ctx, next) {
  ctx.status = 201

  const [error, result] = await
                  to(Task.create(ctx, ctx.params, ctx.request.body))

  if (error || result.error) {
    ctx.status = 400
    ctx.body = error || result.error
  } else {
    ctx.body = result
  }

  return next()
}

const find = async function (ctx, next) {
  ctx.status = 200
  const [error, result] = await to(Task.find(ctx, ctx.params, ctx.query))

  if (error || result.error) {
    ctx.status = 400
    ctx.body = error || result.error
  } else {
    ctx.body = result
  }

  return next()
}

exports.register = (router) => {
  // POST api/v1/tasks
  router.post('/tasks', koaBody, create)

  // GET api/v1/tasks
  router.get('/tasks', find)
}
