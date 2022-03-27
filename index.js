'use strict';

const ID = '__id__';

module.exports = function (redis, name) {
    const NAME = '__' + name + '__';

    const KEY = function (key) {
        return NAME + ':' + key;
    };

    const insert = async (obj)=>{
        let id = obj.id||obj.name,age = obj.maxAge
        if(id) {
            if (age) {
                await redis.sendCommand(['SETEX',KEY(id), age, JSON.stringify(obj)])
            } else {
                await redis.set(KEY(id), JSON.stringify(obj))
            }
        }else{
            throw Error('missing id field')
        }
    }

    const insertEX = async (obj)=>{
        obj.maxAge = obj.maxAge||1
        return insert(obj)
    }

    const findByPattern = async function(pattern){
        let results = [];
        let keys = await redis.keys(KEY(pattern));
        for(let key of keys){
            let res = await redis.get(key)
            if(res){
                results.push(JSON.parse(res))
            }
        }
        return results;
    }

    const findAll = async()=>{
        return findByPattern('*')
    }

    return {
        insert,
        insertEX,
        findByPattern,
        findAll,

        deleteAll: async() => {
            let pattern = KEY('*');
            const deleteKeysScript = `
                local keys = {};
                local done = false;
                local cursor = "0";
                local deleted = 0;
                redis.replicate_commands();
                repeat
                    local result = redis.call("SCAN", cursor, "match", ARGV[1], "count", ARGV[2])
                    cursor = result[1];
                    keys = result[2];
                    for i, key in ipairs(keys) do
                        deleted = deleted + redis.call("UNLINK", key);
                    end
                    if cursor == "0" then
                        done = true;
                    end
                until done
                return deleted;`
            let result = await redis.sendCommand(['EVAL', deleteKeysScript, 0, pattern, 1000])
            return result
        },

        get: async(id)=> {
            const key = KEY(id)
            let result = await redis.get(key)
            return result
        },

        delete:async(id)=> {
            const key = KEY(id)
            await redis.del(key)
        },

        update: async(id, obj)=> {
            const key = KEY(id);
            let result = await redis.get(key);
            if(result){
                await redis.set(key,JSON.stringify(obj))
            }
        },
    };
};
