const bucket = new WeakMap()
let activeEffect

function effect(fn) {
  function effectFn() {
    cleanup(effectFn)
    activeEffect = effectFn
    fn()
  }
  effectFn.deps = []
  effectFn()
}

function cleanup(effectFn) {
  for (let i = 0; i < effectFn.deps.length; i++) {
    const deps = effectFn.deps[i]
    deps.delete(effectFn)
  }
  effectFn.deps = []
}

const data = {
  text: 'hello text',
  ok: true
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

  const effects = depsMap.get(key)
  const effectsToRun = new Set(effects)
  console.log('this key =>', key, effectsToRun)
  effectsToRun && effectsToRun.forEach(fn => fn())
}

effect(() => {
  console.log('run effect')
  document.body.innerText = obj.ok ? obj.text : 'static'
})

setTimeout(() => {
  obj.ok = false
  obj.text = 'hello vue3'
}, 1000)
