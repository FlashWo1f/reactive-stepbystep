const bucket = new WeakMap()

let activeEffect
const effectStack = []

const data = {
  foo: 1,
  bar: 2,
  hh: {
    zz: 6
  }
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

function reactive(data) {
  return new Proxy(data, {
    get(target, key, receiver) {
      track(target, key)
      return Reflect.get(target, key, receiver)
    },
    set(target, key, newVal, receiver) {
      // 先取旧值
      const oldVal = target[key]
      const res = Reflect.set(target, key, newVal, receiver)
      // 比较新旧值
      if (oldVal !== newVal && (oldVal === oldVal || newVal === newVal)) {
        trigger(target, key)
      }
      return res
    },
  })
}

const obj = reactive(data)

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

function watch(source, cb, options = {}) {
  let getter
  if (typeof source === 'function') {
    getter = source
  } else {
    getter = () => traverse(source)
  }

  // 定义新值和旧值
  let oldValue, newValue

  // 装载用户注册的过期回调
  let cleanup

  function onInvalidate(fn) {
    cleanup = fn
  }

  const job = () => {
    // 重新执行 effectFn 得到的是新值
    newValue = effectFn()
    if (cleanup) {
      cleanup()
    }
    cb(newValue, oldValue, onInvalidate)
    // 注意 这里要将老值重新赋值
    oldValue = newValue
  }

  const effectFn = effect(
    () => getter(),
    {
      lazy: true,
      scheduler: () => {
        // 如果是 post 将Job 函数放入微任务队列
        if (options.flush === 'post') {
          const p = Promise.resolve()
          p.then(job)
        } else {
          job()
        }
      },
    }
  )

  if (options.immediate) {
    job()
  } else {
    oldValue = effectFn()
  }
}

watch(
  () => obj.bar,
  (val, oldValue, onInvalidate) => {
    // 定义一个标识，代表当前副作用函数是否过期
    let expired = false
    onInvalidate(() => {
      expired = true
    })
    let delay
    if (val === 3) {
      delay = 500
    } else {
      delay = 300
    }
    delayResult(val, delay).then(res => {
      // 没过期才设置值
      if (!expired) {
        obj.foo = res
      }
    })
  },
)


effect(() => {
  console.log('update', obj.hh.zz)
})

obj.hh.zz = 9

