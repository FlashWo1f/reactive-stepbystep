const bucket = new WeakMap()

// 用一个全局变量存储被注册的副作用函数
let activeEffect

function effect(fn) {
  activeEffect = fn
  fn()
}

const data = {
  text: 'hello world'
}

// 追踪属性数据
function track(target, key) {
  // 当前没有副作用函数 则直接返回
  if (!activeEffect) return target[key]
  // 根据 bucket 和 target 获取 depsMap，它也是 Map 类型: key --> effects
  let depsMap = bucket.get(target)
  if (!depsMap) {
    bucket.set(target, (depsMap = new Map()))
  }
  let deps = depsMap.get(key)
  if (!deps) {
    depsMap.set(key, (deps = new Set()))
  }
  // 将副作用函数放入桶中
  deps.add(activeEffect)
}

// 触发更新
function trigger(target, key) {
  const depsMap = bucket.get(target)
  if (!depsMap) return
  const effects = depsMap.get(key)
  effects && effects.forEach(fn => fn())
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

effect(() => {
  console.log('effect run') // 打印两次
  document.body.innerText = obj.text
})

setTimeout(() => {
  // 副作用函数中没有读取 notExist 属性的值 所以不应该触发副作用重新执行
  obj.notExist = 'hello vue3'
}, 1000)