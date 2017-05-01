'use strict'
const ObjectID = require('mongodb').ObjectID
const to = require('await-to-js').default
const ConnectionMgr = require('./connectionMgr')

exports.find = (tenant, coll, query, page, limit) => {
  return new Promise(async (resolve, reject) => {
    // Acquire a connection
    const conn = ConnectionMgr.acquire()

    // When the connection is available, use it
    conn.then(async (mongo) => {
      limit = limit || 10
      page = page || 1
      query = query || {}
      const skip = page > 0 ? ((page - 1) * limit) : 0
      try {
        const collection = mongo.db(tenant).collection(coll)
        const [error, result] = await to(collection.find(query)
                                .sort({_id: -1})
                                .skip(skip)
                                .limit(limit)
                                .toArray())
        if (error) {
          return reject(error)
        } else {
          return resolve({
            cursor: {
              currentPage: page,
              perPage: limit
            },
            data: result
          })
        }
      } catch (error) {
        reject(error)
      } finally {
        // Release the connection after  us
        ConnectionMgr.release(mongo)
      }
    })
  })
}

exports.insert = (tenant, coll, payload) => {
  return new Promise((resolve, reject) => {
    // Acquire a connection
    const conn = ConnectionMgr.acquire()
    conn.then(async (mongo) => {
      try {
        const collection = mongo.db(tenant).collection(coll)
        const [error, result] = await to(collection.insert(payload))

        if (error) {
          return reject(error)
        } else {
          return resolve(result)
        }
      } catch (error) {
        console.log(error)
        reject(error)
      } finally {
        ConnectionMgr.release(mongo)
      }
    })
  })
}
