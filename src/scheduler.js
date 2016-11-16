'use strict'
const RPC = require('./rpc')
const Bucket = require('./bucket')
const CronJob = require('cron').CronJob
let _maintenanceJob = new WeakMap()
let _capacityJob = new WeakMap()
module.exports = class Scheduler {
  constructor (rpc, bucket, block, mini, nano) {
    if (!(rpc instanceof RPC )) {
      throw new TypeError('Invalid RPC')
    }
    if (!(bucket instanceof Bucket )) {
      throw new TypeError('Invalid Bucket')
    }
    let onPing = (peers, peer)=> {
      let i = -1
      let next = (err)=> {
        if (err) {
          bucket.add(peer)
        }
        i++
        if (i < peers.length) {
          rpc.ping(peer[ i ].id, next)
        }
      }
      next()
    }
    let isCleaning = false
    let clean = (type) => {
      //1. gather all blocks in the cache
      //2. Figure figure out which blocks are already contained at 30% of their current bucket contacts in order of lowest popularity first
      //3. Delete blocks that are 30% redundant until capacity is down to 50%
      //4. If not possible to reach 50% redistribute blocks that are less then 30% redundant and then delete
      //5. If not possible to redistribute sleep until more connections obtained
      isCleaning = true
      let bc
      switch (type) {
        case 1:
          bc = block
          break;
        case 2:
          bc = mini
          break;
        case 3:
          bc = nano
          break;
      }

      let pingBlock = (key, cb)=> {
        let redundancy = Math.floor(bucket.count * config.redundancy)
        redundancy = (redundancy < 1 && bucket.count > 1) ? 1 : redundancy
        let count = 0
        let hash = new Buffer(bs58.decode(key))
        let peers = bucket.closest(hash, bucket.count)
        //loop through peers
        let i = -1
        let next = (err)=> {
          if (err) {
            count--
          }
          if (i > -1) {
            count++
          }
          //if proper amount of redundancy exists then
          if (count >= redundancy) {
            //delete Block
            bc.remove(key, (err)=> {
              if (err) {
                //TODO: Decide what to do when this fails
              }
              return process.nextTick(cb)
            })
          }
          i++
          if (i < peers.length) {
            return rpc.pingValue(peer[ i ].id, hash, type, next)
          } else {
            return process.nextTick(()=> {
              return cb(new Error("Insufficient Peer Redundancy"))
            })
          }
        }
        next()
      }

      let redistribute = []
      //1. Go Through each block marked for  redistribution and retrieve it
      //2. Store it on the network
      //3. Delete it
      let redistributeBlocks = ()=> {
        let i = -1
        let next = (err, block)=> {
          if (err) {

          }
          // stop once capacity is below 50%
          if (bc.capacity <= 50) {
            isCleaning = false
            return
          }
          i++
          if (i < redistribute.length) {
            let key = redistribute[ i ]
            bc.get(key, (err, block, number)=> {
              if (err) {
                return next(err)  //TODO: Figure out what to do when it fails
              }
              rpc.store(block.hash, type, block.data, number, (err)=> {
                if (err) {
                  return next(err)  //TODO: Figure out what to do when it fails
                }
                bc.remove(key, next)
              })
            })
          } else {
            isCleaning = false
            //TODO: figure out what happens at the end
          }
        }
      }
      let loopContent = (content, cb)=> {
        let i = -1
        let key
        let next = (err)=> {
          if (err) {
            redistribute.push(key)
          }
          i++
          if (i < content.length) {
            key = content[ i ]
            return pingBlock(key, next)
          } else {
            return process.nextTick(cb)
          }
        }
        next()
      }

      let stop = bc.number
      let i = 0
      //Loop through all block buckets
      let next = (err, content)=> {
        //increment the loop and get next bucket's content
        let increment = ()=> {
          i++
          if (i >= stop) {
            return bc.contentAt(i, next)
          }
          else {
            // if the capacity  is  above 50% still
            // then go through the redistribution list and try to store at other nodes
            return redistributeBlocks()
          }
        }
        if (err) {
          //TODO: Figure out WTF to do when this fails
        }
        //ping bucket contacts until 30% of contacts respond with a value
        if (content) {
          loopContent(content, ()=> {
            //cleared enough space
            if (bc.capacity <= 50) {
              isCleaning = false
              return
            } else {
              return increment()
            }
          })
        } else {
          return increment()
        }
      }
      next()
    }

    let onCapacity = (type, capacity)=> {
      let fillRate
      let capacityJob = _capacityJob.get(this)
      if (capacityJob) {
        capacityJob.stop()
      }
      if (capacity >= 50) {
        fillRate = config.maxFillRate
        if (capacity >= 80) { //TODO: Figure out what to do at 80%
          if (isCleaning) { //if process has begun do not restart it
            return
          }
          return clean(type)
        }
      } else {
        fillRate = config.maxFillRate * (capacity / 50)
      }
      let now = new Date()
      let then = new Date(now)
      then.setTime(now.getTime() + (fillRate * 60 * 60 * 1000))
      let bc
      switch (type) {
        case 1:
          bc = block
          break;
        case 2:
          bc = mini
          break;
        case 3:
          bc = nano
          break;
      }
      capacityJob = new CronJob(then, ()=> {
        bc.contentFilter((err, contentFilter)=> {
          if (err) {
            return //TODO: Decide what happens when this fails
          }
          rpc.random(0, 1, type, contentFilter, ()=> {})
        })

      })
      _capacityJob.set(this, capacityJob)
    }
    blockRouter.on('capacity', onCapacity)
    bucket.on('ping', onPing)
    let maintainBucket = ()=> {
      let nodes = bucket.toArray()
      for (let i = 0; i < nodes.length; i++) {
        let node = nodes[ i ]
        rpc.ping(node.id, ()=> {})
      }
    }
    let maintenanceJob = new CronJob('*/15 * * * *', maintainBucket) // every 15 minutes
    _maintenanceJob.set(this, maintenanceJob)

  }

}