# Multi-tenancy with KoaJS and MongoDB

Multi-tenancy is all about supporting multiple tenants or customers for a single application. The core concept is that we attach a context to an in-coming request, which helps in identifying the tenant and respond accordingly.

There are three patterns for multi-tenancy, which are based on how infrastructure such as application servers and database servers and other components are shared. The three patterns are

* Nothing Shared
* Partially Shared
* Everything shared

In the nothing shared model, each tenant have their own application server and database server. It is not the most efficient model since application server and database servers have an instance each per tenant. Maintenance of such a system with large tenant base would be very cumbersome. Mostly such systems are commissioned due to customer requests to have a completely isolated application for security reasons.

In partially shared model, the application server or the database server may have one instance per customer. Most of the times it would be the database server. The idea is to provide isolation at the data layer and leverage sharing of application servers.

In everything shared model, the application server and database servers are shared. The tenant identification is done through a tenant key in the database. 

Well that is a small peek in to the theory, now let us build a partially shared multi-tenant application using koajs and mongodb, we will develop a set of restful service that uses subdomain to identify a tenant. Each tenant will have their own mongo database, and we will route to appropriate database based on subdomain from the incoming request.

Prerequisites: nodejs 7.8.0, npm 4.2.0 and  mongodb native driver. Also we will be developing using koa 2.0 style with async and await.

I am assuming that mongodb 3.x is already installed or you can get hold of a hosted mongodb instance. 

Setup the project
Create a directory and cd into it
```
mkdir multi-tenant-example
cd multi-tenant-example
```

Initialise project and install required npm modules

```
npm init - y
# The above command should create a basic package.json
# let us now install required node modules
npm i -S koa koa-router@next koa-mount koa-body@2
```

After installation check your package.json, it must look something like this
```
"dependencies": {
    "koa": "2.2.0",
    "koa-body": "2.0.0",
    "koa-mount": "3.0.0",
    "koa-router": "7.1.1"
  }
```

Now let us create the basic structure of the application
```
touch app.js server.js
mkdir config models db services
```
Let us start coding by adding some config code

```
# create these files and add
touch index.js config.global.js config.development.js config.production.js config.test.js
```
config/index.js
```
'use strict'
const env = process.env.NODE_ENV || 'development'
module.exports = require('./config.' + env)
```
config/config.global.js
```
'use strict'
// Put some global  / default configurations here
const config = { app: {}, mongo: {} }
config.env = 'development'
config.app.port = process.env.port || 3000
config.mongo.host = 'localhost'
config.mongo.dbName = 'myApp'
module.exports = config
```
config/config.development.js
```
'use strict'

const config = require('./config.global')

config.env = 'development'
config.mongo.dbName = config.mongo.dbName + '_dev'

module.exports = config
```
config/config.production.js
```
'use strict'

let config = require('./config.global')

config.env = 'production'
config.mongo.dbName = config.mongo.dbName + '_prod'

module.exports = config
```
config/config.test.js
```
'use strict'

let config = require('./config.global')

config.env = 'test'
config.mongo.dbName = config.mongo.dbName + '_test'

module.exports = config
```

With application config done, let us create the main application.

Add the following set of code within app.js

```
'use strict'
const Koa = require('koa')
const mount = require('koa-mount')
const config = require('./config')

// Create the main application
const app = new Koa()

// Create a koa application for v1 services
const v1 = new Koa()
v1.use(require('./services').v1)

// mount the v1 app as a middleware in the
// main app
app.use(mount('/api/v1', v1))
module.exports = app

```

Now let us create a task service, follow on

```
# cd into services directory
touch index.js

# make a v1 directory & cd into it
mkdir v1
cd v1

touch index.js tasks.js
```

services/v1/tasks.js
```
'use strict'
const koaBody = require('koa-body')()

const create = async function (ctx, next) {
  ctx.body = 'CREATE::TASK TBD'
  return next()
}

const find = async function (ctx, next) {
  ctx.body = 'LIST::TASKS TBD'
  return next()
}

exports.register = (router) => {
  // POST api/v1/tasks
  router.post('/tasks', koaBody, create)

  // GET api/v1/tasks
  router.get('/tasks', find)
}
```

we have written two routes, one to create a task and another to list tasks, let is keep it minimal.

Add the code given below to services/v1/index.js

```
'use strict'

const Router = require('koa-router')
const router = new Router()

require('./tasks').register(router)

module.exports = router.middleware()
```

Finish up services by adding the following code into services/index.js
```
'use strict'

exports.v1 = require('./v1')
```

Let us add code to server.js to start the application
```
'use strict'

const config = require('./config')
const app = require('./app')

app.listen(config.app.port, function () {
  console.log('services started at ' + config.app.port)
})
```
Let is take what we have built so far for a spin

```
# type
node server.js
```
using postman, curl or any other tool check the endpoints

```
curl http://localhost:3000/api/v1/tasks
curl -X POST http://localhost:3000/api/v1/tasks

should return

LIST::TASKS TBD

and

CREATE::TASK TBD

respectively
```

Let us turn the focus to database, we will create a connection manager to handle connection pooling and a data access layer for models to query the database.

db/connectionMgr.js
```
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
```
The connectionMgr uses generic-pool, so install it
```
npm i -S generic-pool
```
With connection manager added, let us now add code for database access. This is
where it becomes interesting. We will add a insert and find method, pay attention
to the first two parameters of the data access methods the tenant and the collection.

The tenant parameter identifies the tenant specific database and the collection refers to the
model's collection.

db/index.js
```
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
        console.log(tenant, coll)
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
```

Let us add the model, here model is a very loose definition we are basically going to write static accessor methods.

models/task.js

```
'use strict'
const to = require('await-to-js').default
const DB = require('../db')

const COLLECTION = 'tasks'

class Task {
  static create (ctx, params, data) {
    return new Promise(async (resolve, reject) => {

      const [error, result] = await to(DB.insert(ctx.tenant, COLLECTION, data))

      if (error) {
        return resolve({error})
      }

      resolve(result)
    })
  }

  static find (ctx, params, query) {
    return new Promise(async (resolve, reject) => {
      const [error, processes] = await to(DB.find(ctx.tenant, COLLECTION))
      if (error) {
        return resolve({error})
      }
      return resolve(processes)
    })
  }
}

module.exports = Task
```

We will make changes to the application startup to initialize the connection manager

Add the lines below to app.js just above the line `const app = new Koa()`
```
const mongoOpts = {
  host: config.mongo.host,
  max: 5,
  min: 1,
  timeout: 30000,
  logout: false
}

// init the connection pool
require('./db/connectionMgr').init(mongoOpts)

```

We need a middleware to set tenants to context, add the middleware code after `const app = new Koa()`

```
async function setTenant (ctx, next) {
  const domain = ctx.subdomains[4]
  ctx.tenant = domain || 'default'
  await next()
}

app.use(setTenant)
```

We will be using xip.io to set subdomains in our requests, more about this a bit later.

Let us now complete the task service, replace service/v1/tasks.js with code given below
```
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
```
Before we test the application we need to install some more modules, let us install mongodb (native driver) and lodash. Also ensure, your mongodb is up and running.

```
npm i -S mongodb lodash generic-pool await-to-js
```
A quick word about await-to-js module. The module is very helpful async await style of coding by removing the need for wrapping the calls in a try catch block. More information can be found in the blog [http://blog.grossman.io/how-to-write-async-await-without-try-catch-blocks-in-javascript/]

To test the code, try to find your ip address using ifconfig assuming it is 10.0.0.3, you can use the service xip.io to access your machine using the url http://10.0.0.3.xip.io

To simulate multi domain access try the application using url
* http://alpha.<your_ip>.xip.io:3000 and
* http://beta.<your_ip>.xip.io:3000

Once again, use curl / postman to try out the post methods as well.

We have made a quick introduction to multi-tenancy and implemented a partially shared model with application layer shared and database not shared. The code even though is functional is far from a production grade code. I hope people can use the model to build further.

If you have followed this far, thanks a lot for your time. Please let me know what you think it will help me improve further.

Github Repository: [https://github.com/harin76/multi-tenant-example]
