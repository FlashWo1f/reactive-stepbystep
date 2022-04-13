const bucket = new WeakMap()

let activeEffect
const effectStack = []

const data = {
  foo: 1,
  bar: true,
}

function effect(fn) {
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
  effectsToRun && effectsToRun.forEach(fn => fn())
}


effect(() => {
  obj.foo++
})

