const bucket = new WeakMap()

let activeEffect
const effectStack = []

const data = {
  foo: 1,
  bar: true,
}

function effect(fn, options) {
  const effectFn = () => {
    // 调用 cleanup 清除
    cleanup(effectFn)
    activeEffect = effectFn
    // 在调用前将当前副作用压入栈
    effectStack.push(activeEffect)
    fn()
    // 执行完后出栈
    effectStack.pop()
    // 将 activeEffect 还原之前外层的值
    activeEffect = effectStack[effectStack.length - 1]
  }
  effectFn.options = options
  // effectFn.deps 用来存储所有与该副作用相关的依赖集合
  effectFn.deps = []
  effectFn()
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
  if (!activeEffect) return target[key]
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

effect(
  () => {
    document.body.innerText = obj.foo
    console.log(obj.foo)
  },
  // options
  {
    // 调度器 scheduler 是一个函数
    scheduler(fn) {
      // 每次调度 将副作用函数加入 jobQueue
      jobQueue.add(fn)
      // 刷新队列
      flushJob()
    }
  }
)

// 2 将不会被打印
obj.foo++
obj.foo++
