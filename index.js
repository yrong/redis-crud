const Redis = require('redis')
const config = require('config')
const bluebird = require('bluebird')
bluebird.promisifyAll(Redis.RedisClient.prototype)
bluebird.promisifyAll(Redis.Multi.prototype)

/**
 * init redis client
 */
let redis_config
try{
    redis_config = config.get('redis')
}catch(err){
    redis_config = {
        "host": "localhost",
        "port": 6379
    }
}
const client = Redis.createClient(redis_config)
client.select(1, function() {console.log('select redis database 1')})

const Model = require('./model')
const model = (name) => Model(client,name)


module.exports = model