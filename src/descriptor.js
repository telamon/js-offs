'use strict'
const Block = require('./block')
const config = require('../config.js')
let _data = new WeakMap()
const _descriptorPad = config.descriptorPad
const _blockSize = config.blockSize
let _blockArr = new WeakMap()
let _max = new WeakMap()
let _size = new WeakMap()
let _tupleSize = config.tupleSize
module.exports = class Descriptor {
  constructor () {
    _data.set(this, [ new Buffer(0) ])
    _blockArr.set(this, [])
    _max.set(this, Math.floor(_blockSize / _descriptorPad) * _descriptorPad)
    _size.set(this, 0)
  }

  //once blocks have been created the descriptor is sealed
  get sealed () {
    return (_blockArr.get(this).length !== 0)
  }

  //variadic function and it does expect input
  tuple () {
    if (!this.sealed) {
      if (arguments.length === 0) {
        throw new Error('Invalid Tuple')
      }
      if ((arguments.length === 1) && (!Array.isArray(arguments[ 0 ]))) {
        throw new Error('Invalid Tuple')
      }
      let args
      if (arguments.length === 1) {
        args = arguments[ 0 ]
      } else {
        args = [ ...arguments ]
      }

      let dblocks = _data.get(this) // descriptor blocks

      let size = _size.get(this)
      let max = _max.get(this)
      for (let i = 0; i < args.length; i++) {
        let data = dblocks[ dblocks.length - 1 ] //data of current descriptor
        let block = args[ i ]
        if (!(block instanceof Block)) {
          throw new Error("Invalid Block In Tuple")
        }

        let keybuf = block.hash
        if (size < max) {
          data = Buffer.concat([ data, keybuf ])
          dblocks[ dblocks.length - 1 ] = data
          _data.set(this, dblocks)
          size += _descriptorPad
          _size.set(this, size)
        } else {

          let last = data.slice((data.length - _descriptorPad), data.length)
          let old = data.slice(0, (data.length - _descriptorPad))

          dblocks[ dblocks.length - 1 ] = old
          data = Buffer.concat([ last, keybuf ])
          dblocks[ dblocks.length ] = data.slice(0)
          _data.set(this, dblocks)
          size = 2 * _descriptorPad
          _size.set(this, size)
        }
      }
    } else {
      throw new Error("Descriptor has been sealed")
    }
  }

  blocks () {
    let blockArr = _blockArr.get(this)
    if (blockArr.length == 0) {
      let dblocks = _data.get(this)

      if (dblocks.length === 1) {
        blockArr = [ new Block(dblocks[ 0 ]) ]
        _blockArr.set(this, blockArr)
        return blockArr
      } else {
        let last
        for (let i = (dblocks.length - 1); i >= 0; i--) {
          let data = dblocks[ i ]
          if (last) {
            data = Buffer.concat([ data, last ])
            dblocks[ i ] = data
          }
          let block = new Block(data)
          blockArr.unshift(block)
          _blockArr.set(this, blockArr)
          last = block.hash
        }

        _data.set(this, dblocks)
        return blockArr
      }
    } else {
      return blockArr
    }
  }
}