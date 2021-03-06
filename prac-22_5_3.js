// practice in 2022-5-3
// 首先要知道 target  deps  bucket 之间的数据关系以及他们本身的数据结构(set map weakMap)
const bucket = new WeakMap()

let activeEffect

const effectStack = []

function pushEffect(effect) {
  effectStack.push(effect)
  activeEffect = effect
}

function popEffect() {
  effectStack.pop()
  activeEffect = effectStack[effectStack.length - 1]
}

function effect(fn, options = {}) {
  const effectFn = () => {
    pushEffect(effectFn)
    cleanup(effectFn)
    fn()
    popEffect()
  }
  effectFn.options = options
  // 用来存储所有与 effectFn 相关的响应式属性
  effectFn.deps = []
  effectFn()
}

function cleanup(effectFn) {
  for (let i = 0; i < effectFn.deps.length; i++) {
    const deps = effectFn.deps[i]
    deps.delete(effectFn)
  }

  effectFn.deps.length = 0
}

const jobQueue = new Set()

// 使用一个标记代表是否正在刷新队列 一次 isFlushing 可以视为一次批量更新
let isFlushing = false
function flushJob() {
  if (isFlushing) {
    return 
  }
  isFlushing = true
  // 通过一个微任务和同步任务的时间差来收集同一时间执行的任务，相同任务则去重
  Promise.resolve().then(res => {
    jobQueue.forEach(job => job())
  }).finally(() => {
    isFlushing = false
  })
}

const data = {
  ok: true,
  foo: 2,
  bar: 3
}

const obj = new Proxy(data, {
  get(target, key) {
    track(target, key)
    // console.log('进入 GET')
    return target[key]
  },
  set(target, key, newVal) {
    // console.log('进入 SET', key, newVal)
    target[key] = newVal
    trigger(target, key)
    return true
  }
})

// get 拦截函数中调用 track 函数追踪变化
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
  activeEffect.deps.push(deps)
  deps.add(activeEffect)
}

function trigger(target, key) {
  const depsMap = bucket.get(target)
  if (!depsMap) return
  const effects = depsMap.get(key)
  const cloneEffects = new Set()
  effects.forEach(ef => {
    if (activeEffect !== ef) {
      cloneEffects.add(ef)
    }
  })
  cloneEffects && cloneEffects.forEach(effect => {
    if (effect.options.scheduler) {
      effect.options.scheduler(effect)
    } else {
      effect()
    }
  })
}

// demo: cleanup 
effect(() => {
  const name = obj.ok ? obj.bar : 'not'
  console.log('changed', name)
})
obj.ok = false
obj.bar++

// demo: stack
// let temp1, temp2
// effect(() => {
//   console.log('effect1 run')
//   effect(() => {
//     console.log('effect2 run')
//     temp2 = obj.bar
//   })
//   temp1 = obj.foo
// })
// obj.foo = 2

// demo: infinity loop effect 函数中响应式数据的读取和赋值操作在一起
// effect(() => {
//   console.log('obj.foo', obj.foo)
//   obj.foo++
//   obj.foo++
//   obj.foo++
//   obj.foo++
// })
// obj.foo++

// demo: 可调度 scheduler
// effect(
//   () => {
//     const name = obj.bar
//     console.log('name', name)
//   },
//   {
//     scheduler(fn) {
//       Promise.resolve().then(() => fn())
//     }
//   }
// )
// obj.bar = 5
// console.log('later')

// demo: 批量更新

// effect(
//   () => {
//     console.log(obj.foo)
//   },
//   {
//     scheduler(fn) {
//       jobQueue.add(fn)
//       flushJob()
//     }
//   }
// )
// obj.foo++
// obj.foo++
// obj.foo++



console.log('bucket', bucket)
