'use strict';

const ID = '__id__';

module.exports = function (redis, name) {
    const NAME = '__' + name + '__';

    const KEY = function (id) {
        return NAME + ':' + id;
    };

    return {
        insert(obj) {
            // run the beforeInsert hook
            let before;
            try {
                before = this.beforeInsert && this.beforeInsert(obj);
            } catch (e) {
                return Promise.reject(e);
            }

            return Promise.resolve(before).then(() => {
                return new Promise((resolve, reject) => {
                    let id = obj.name
                    if(id){
                        redis.SETNX(KEY(id), JSON.stringify(obj),(err,res)=>{
                            if (res) {
                                // Run the afterInsert hook
                                const after = this.afterInsert && this.afterInsert(obj, id);
                                return Promise.resolve(after).then(() => {
                                    resolve(id);
                                });
                            } else {
                                reject(new Error(`Could not create object for ${name}. ${id} already exist`))
                            }
                        })
                    }else{
                        reject(new Error(`missing name field`))
                    }

                })
            });
        },

        findAll: function(){
            return new Promise((resolve, reject) => {
                let results = [],promises = []
                redis.keys(KEY('*'),(err,keys)=>{
                    if(err)
                        reject(err)
                    let findByKey = (key)=> {
                        return new Promise((resolve, reject) => {
                            redis.get(key, (err, val) => {
                                if (err)
                                    reject(err)
                                if (val)
                                    resolve(JSON.parse(val))
                            })
                        })
                    }
                    for(let key of keys){
                        promises.push(findByKey(key))
                    }
                    Promise.all(promises).then(resolve).catch(reject)
                });
            })
        },

        deleteAll:function(){
            return new Promise((resolve, reject) => {
                redis.eval("return redis.call('del', unpack(redis.call('keys', ARGV[1])))", 0, KEY('*'), (err, res) => {
                    if (err)
                        reject(err)
                    if (res)
                        resolve(res)
                })
            })
        },

        iterate(limit) {
            let _cursor = 0;
            let _eof = false;

            // Return the object that should be used for retrieved data
            return {
                get eof() {
                    return _eof;
                },

                next: function () {
                    // Return null if eof has been reached already
                    if (_eof) {
                        return Promise.resolve(null);
                    }

                    const records = [];
                    function yieldResult(count) {
                        return redis.scanAsync(_cursor, 'match', KEY('*'), 'count', count).then(res => {
                            // Update the cursor for further calls
                            _cursor = parseInt(res[0]);

                            // Append the result obtained into the final records list
                            if (res[1].length > 0) {
                                records.push.apply(records, res[1]);
                            }

                            // Check if we have reached the end of the list or
                            // got the maximum number of records for each request
                            if (_cursor === 0) {
                                _eof = true;
                                return records;
                            } else if (records.length === limit) {
                                return records;
                            } else {
                                return yieldResult(limit - records.length);
                            }
                        });
                    }

                    return yieldResult(limit);
                },
            };
        },

        get(id) {
            const key = KEY(id);

            // only return if the key exists
            return redis.existsAsync(key).then(res => {
                if (res === 0) {
                    // Record not found
                    return null;
                }

                return redis.getAsync(key).then((res)=>{
                    return JSON.parse(res)
                });
            });
        },

        getId(obj) {
            return obj[ID];
        },

        delete(id) {
            const key = KEY(id);

            // Only run if the record already exists
            return redis.existsAsync(key).then(res => {
                if (res === 0)
                    return false;

                // Retrieve the object being deleted
                return redis.getAsync(key);
            }).then((obj) => {
                // Run the beforeDelete hook
                return Promise.resolve(this.beforeDelete && this.beforeDelete(id, obj)).then(() => {
                    return redis.delAsync(key).then(() => {
                        return Promise.resolve(this.afterDelete && this.afterDelete(id, obj));
                    });
                });
            }).then(() => {
                return true;
            });
        },

        update(id, obj) {
            const key = KEY(id);

            // The operation can be performed only if the record exists already
            return redis.existsAsync(key).then(res => {
                if (res === 0)
                    return false;

                // run the before hook
                return Promise.resolve(this.beforeUpdate && this.beforeUpdate(id, obj)).then(() => {

                    return new Promise((resolve, reject) => {
                        redis.set(KEY(id),JSON.stringify(obj),(err,res)=>{
                            if (res === 'OK') {
                                // run the after hook
                                const after = this.afterUpdate && this.afterUpdate(id, obj);
                                return Promise.resolve(after).then(() => resolve(true))
                            } else {
                                reject(new Error(`Could not update object for ${name} with id ${id}.` +
                                    ` The server said ${res}`))
                            }
                        })
                    })
                });
            });
        },
    };
};