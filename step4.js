const bucket = new WeakMap()

// 用一个全局变量存储被注册的副作用函数
let activeEffect

function effect(fn) {
  const effectFn = () => {
    // 调用 cleanup 清除
    cleanup(effectFn)
    activeEffect = effectFn
    fn()
  }
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

const data = {
  text: 'hello world',
  ok: true
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
  activeEffect.deps.push(deps)
  console.log('activeEffect', activeEffect.deps)
}

// 触发更新
function trigger(target, key) {
  const depsMap = bucket.get(target)
  if (!depsMap) return
  const effects = depsMap.get(key)
  // 为了避免 调用副作用函数前清除 Set 的某一项后 再有调用副作用函数后的新增 Set 造成的调用循环问题
  const effectsToRun = new Set(effects)
  console.log('this key =>', key, effectsToRun)
  effectsToRun && effectsToRun.forEach(fn => fn())
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
  console.log('effect run')
  document.body.innerText = obj.ok ? obj.text : 'text'
})

setTimeout(() => {
  // 副作用函数中没有读取 notExist 属性的值 所以不应该触发副作用重新执行
  obj.ok = false
  obj.text = 'hello vue3'
}, 1000)