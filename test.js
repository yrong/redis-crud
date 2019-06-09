const Redis = require('redis')
const Model = require('./index')
const should = require('should')

describe("redis-crud", () => {

    const prefix = "crud-test";
    const redisOptions = {
        host: process.env.REDIS_HOST || "127.0.0.1",
        auth_pass: process.env.REDIS_AUTH  || "admin",
        db:1
    };
    const model = Model(Redis.createClient(redisOptions),prefix)

    it("insert&findAll&deleteAll", () => {
        const obj1 = {id:1,a:'a'},obj2 = {id:2,b:'b'},obj3 = {id:3,c:'c',maxAge:1}
        const wait = (interval) => {
            return new Promise((resolve, reject) => {
                setTimeout(resolve,interval)
            })
        }
        return model.insert(obj1)
            .then(() => model.findAll())
            .should.eventually.be.instanceof(Array).and.have.lengthOf(1)
            .then(()=>model.insert(obj2))
            .then(() => model.findAll())
            .should.eventually.be.instanceof(Array).and.have.lengthOf(2)
            .then(()=>model.deleteAll())
            .should.eventually.be.eql(2)
            .then(()=>model.insertEX(obj3))
            .then(()=> wait(2000))
            .then(() => model.findAll())
            .should.eventually.be.instanceof(Array).and.have.lengthOf(0)
    });
})
