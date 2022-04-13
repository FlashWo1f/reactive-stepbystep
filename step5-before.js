const bucket = new WeakMap()

let activeEffect

const data = {
  foo: true,
  bar: true,
}

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
  const effectsToRun = new Set(effects)
  console.log('this key =>', key, effectsToRun)
  effectsToRun && effectsToRun.forEach(fn => fn())
}

let temp1, temp2
effect(() => {
  console.log('effectFn1 run!')
  effect(() => {
    console.log('effectFn2 run!')
    temp2 = obj.bar
  })

  temp1 = obj.foo
})


setTimeout(() => {
  // 这里修改了 foo 的属性 反而触发了 effectFn2 的打印 
  // 问题出在用 activeEffect 全局变量上 这意味着同一时刻副作用函数只能有一个, 如果内层有 副作用嵌套的话就会覆盖 activeEffect 的值
  obj.foo = false
}, 1000)
