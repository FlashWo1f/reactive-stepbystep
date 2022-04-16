const bucket = new WeakMap()

let activeEffect
const effectStack = []

const data = {
  foo: 1,
  bar: 2,
}

function effect(fn, options = {}) {
  const effectFn = () => {
    // 调用 cleanup 清除
    cleanup(effectFn)
    activeEffect = effectFn
    // 在调用前将当前副作用压入栈
    effectStack.push(activeEffect)
    const res = fn()
    // 执行完后出栈
    effectStack.pop()
    // 将 activeEffect 还原之前外层的值
    activeEffect = effectStack[effectStack.length - 1]
    return res
  }
  effectFn.options = options
  // effectFn.deps 用来存储所有与该副作用相关的依赖集合
  effectFn.deps = []
  // 只有非 lazy 才执行
  if (!options.lazy) {
    effectFn()
  }
  // 将副作用函数作为返回值返回
  return effectFn
}

function cleanup(effectFn) {
  for (let i = 0; i < effectFn.deps.length; i++) {
    const dep = effectFn.deps[i]
    dep.delete(effectFn)
  }
  // 最后重置 effectFn.deps 数组
  effectFn.deps.length = 0
}

const obj = new Proxy(data, {
  get(target, key) {
    track(target, key)
    return target[key]
  },
  set(target, key, newVal) {
    target[key] = newVal
    trigger(target, key)
    return true
  }
})

function track(target, key) {
  if (!activeEffect) return 
  let depsMap = bucket.get(target)
  if (!depsMap) {
    bucket.set(target, (depsMap = new Map()))
  }
  let deps = depsMap.get(key)
  if (!deps) {
    depsMap.set(key, (deps = new Set()))
  }
  deps.add(activeEffect)
  activeEffect.deps.push(deps)
}

function trigger(target, key) {
  const depsMap = bucket.get(target)
  if (!depsMap) return 
  const effects = depsMap.get(key)
  // 为了避免 调用副作用函数前清除 Set 的某一项后 再有调用副作用函数后的新增 Set 造成的调用循环问题
  const effectsToRun = new Set()
  effects && effects.forEach(v => {
    if (v !== activeEffect) {
      effectsToRun.add(v)
    }
  })
  console.log('this key =>', key, effectsToRun)
  effectsToRun && effectsToRun.forEach(effectFn => {
    if (effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn)
    } else {
      effectFn()
    }
  })
}

// 定义一个任务队列
let jobQueue = new Set()
// 创建一个 Promise 实例，用它将一个任务加入微任务队列
const p = Promise.resolve()

// 当前是否正在刷新队列
let isFlushing = false
function flushJob() {
  if (isFlushing) return
  isFlushing = true
  p.then(() => {
    // 微任务队列中刷新 jobQueue 队列
    jobQueue.forEach(job => job())
  }).finally(() => isFlushing = false)
}

const sumRes = computed(
  () => {
    return obj.foo + obj.bar
  },
  // options
  {
    lazy: true
  }
)

function computed(getter) {
  // 用一个值来缓存
  let value
  // dirty 标志
  let dirty = true

  const effectFn = effect(getter, {
    lazy: true,
    scheduler() {
      // 当依赖项 obj.foo 或者 obj.bar 发生变化时 将 dirty 重置为 true 
      dirty = true
      // 计算属性依赖的响应式数据发生变化，手动调用
      trigger(obj, 'value')
    }
  })

  const obj = {
    get value() {
      if (dirty) {
        value = effectFn()
        dirty = false
      }
      // 读取 value 时，手动调用 track 函数追踪
      track(obj, 'value')
      return value
    }
  }

  return obj
}


console.log('sumRes:', sumRes, sumRes.value)


// 缺陷：当我们在另一个 effect 副作用函数中读取了计算属性 sumRes 的值, 并且修改其依赖项的值时，并不会触发副作用函数的执行
// 原因：从本质上看这就是一个典型的 effect 嵌套. 计算属性内部有自己的 effect，并且是懒执行的。对于 getter 来说，他只会把内部的 effect 收集为依赖
// 而当计算属性用于另外一个 effect 时，发生 effect 嵌套，外层 effect 不会被内部 effect 的响应式数据收集。
// 解决办法：读取计算属性值时手动地调用 track 函数进行收集，手动 trigger
effect(
  () => {
    console.log('外层effect: ', sumRes.value)
  }
)

obj.foo++
console.log('sumRes:', sumRes, sumRes.value)
