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
// seen: 看见 （收集依赖）
function traverse(value, seen = new Set()) {
  // 如果读取的数据时原始值或者已经被读过了，则什么都不做
  if (typeof value !== 'object' || value === null || seen.has(value)) return
  seen.add(value)
  // 暂时不考虑数组等其他结构
  for (const k in value) {
    traverse(value[k], seen)
  }
  return value
}

function watch(source, cb) {
  let getter
  if (typeof source === 'function') {
    getter = source
  } else {
    getter = () => traverse(source)
  }

  // 定义新值和旧值
  let oldValue, newValue

  const effectFn = effect(
    () => getter(),
    {
      lazy: true,
      scheduler() {
        // 重新执行 effectFn 得到的是新值
        newValue = effectFn()
        cb(newValue, oldValue)
        // 注意 这里要将老值重新赋值
        oldValue = newValue
      }
    }
  )

  // 手动调用副作用函数，拿到的就是第一次执行的值，也就是旧值
  // debugger
  oldValue = effectFn()
  console.log('####', JSON.parse(JSON.stringify(oldValue)))
}

// watch(
//   () => obj.bar,
//   (val, oldValue) => {
//     console.log('watch change', 'new => ', val, '   old => ', oldValue)
//   }
// )

watch(
  obj,
  (val, oldValue) => {
    // js 复杂数据类型导致下面 val 和 oldValue 值是一样的
    console.log('watch change', 'new => ', JSON.parse(JSON.stringify(val)).bar, '   old => ', JSON.parse(JSON.stringify(oldValue)).bar)
  }
)

obj.bar++