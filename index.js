'use strict';

const ID = '__id__';

module.exports = function (redis, name) {
    const NAME = '__' + name + '__';

    const KEY = function (key) {
        return NAME + ':' + key;
    };

    const beforeInsert = ()=>{};

    const afterInsert = ()=>{};

    const insert = async (obj)=>{
        let before;
        try {
            before = beforeInsert && beforeInsert(obj);
        } catch (e) {
            return Promise.reject(e);
        }

        return Promise.resolve(before).then(() => {
            return new Promise((resolve, reject) => {
                let id = obj.id||obj.name,age = obj.maxAge
                if(id){
                    if(age){
                        redis.setex(KEY(id), age, JSON.stringify(obj),(err,res)=>{
                            if (res) {
                                const after = afterInsert && afterInsert(obj, id);
                                return Promise.resolve(after).then(() => {
                                    resolve(id);
                                });
                            }
                        })
                    }else{
                        redis.set(KEY(id), JSON.stringify(obj),(err,res)=>{
                            if (res) {
                                const after = afterInsert && afterInsert(obj, id);
                                return Promise.resolve(after).then(() => {
                                    resolve(id);
                                });
                            }
                        })
                    }
                }else{
                    reject(new Error(`missing id or name field`))
                }
            })
        });
    }

    const insertEX = async (obj)=>{
        obj.maxAge = obj.maxAge||1800
        return insert(obj)
    }

    const findByPattern = async function(pattern){
        return new Promise((resolve, reject) => {
            let results = [],promises = []
            redis.keys(KEY(pattern),(err,keys)=>{
                if(err)
                    reject(err)
                let findByKey = (key)=> {
                    return new Promise((resolve, reject) => {
                        redis.get(key, (err, res) => {
                            if (err)
                                reject(err)
                            if (res)
                                resolve(JSON.parse(res))
                        })
                    })
                }
                for(let key of keys){
                    promises.push(findByKey(key))
                }
                Promise.all(promises).then(resolve).catch(reject)
            });
        })
    }

    const findAll = async()=>{
        return findByPattern('*')
    }

    return {
        beforeInsert,
        afterInsert,
        insert,
        insertEX,
        findByPattern,
        findAll,

        deleteAll:function(){
            return new Promise((resolve, reject) => {
                redis.eval("return redis.call('del', 'default-template',unpack(redis.call('keys', ARGV[1])))", 0, KEY('*'), (err, res) => {
                    if(err)
                        reject(err)
                    else
                        resolve(res)
                })
            })
        },

        get(id) {
            const key = KEY(id);
            return new Promise((resolve, reject) => {
                redis.get(key,(err,res)=>{
                    if(res)
                        resolve(JSON.parse(res))
                    else
                        resolve()
                })
            })
        },

        getId(obj) {
            return obj[ID];
        },

        delete(id) {
            const key = KEY(id);
            return new Promise((resolve, reject) => {
                redis.get(key,(err,res)=>{
                    if(res){
                        Promise.resolve(this.beforeDelete && this.beforeDelete(id, obj)).then(() => {
                            redis.del(key,(err,res)=>resolve(res))
                        })
                    }else{
                        reject(`key ${id} does not exist`)
                    }
                })
            })
        },

        update(id, obj) {
            const key = KEY(id);
            return new Promise((resolve, reject) => {
                redis.get(key,(err,res)=>{
                    if(res){
                        Promise.resolve(this.beforeUpdate && this.beforeUpdate(id, obj)).then(() => {
                            redis.set(KEY(id),JSON.stringify(obj),(err,res)=>resolve({res}))
                        })
                    }else{
                        reject(`key ${id} does not exist`)
                    }
                })
            })
        },
    };
};
