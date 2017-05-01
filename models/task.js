'use strict'
const to = require('await-to-js').default
const DB = require('../db')

const COLLECTION = 'tasks'

class Task {
  static create (ctx, params, data) {
    return new Promise(async (resolve, reject) => {

      const [error, result] = await to(DB.insert(ctx.tenant, COLLECTION, data))

      if (error) {
        return resolve({error: Errors.UNKNOWN})
      }

      resolve(result)
    })
  }

  static find (ctx, params, query) {
    return new Promise(async (resolve, reject) => {
      const [error, processes] = await to(DB.find(ctx.tenant, COLLECTION))
      if (error) {
        return resolve({error: Errors.UNKNOWN})
      }
      return resolve(processes)
    })
  }
}

module.exports = Task
