const bucket = new WeakMap()

let activeEffect
const effectStack = []

const pushEffect = (effectFn) => {
  effectStack.push(effectFn)
  activeEffect = effectFn
}

const popEffect = () => {
  effectStack.pop()
  activeEffect = effectStack[effectStack.length - 1]
}

function effect(fn, options = {}) {
  const effectFn = () => {
    pushEffect(effectFn)
    cleanup(effectFn)
    console.log(fn)
    fn()
    popEffect()
  }
  effectFn.options = options
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

const data = {
  foo: 1,
  bar: 2,
  ok: true,
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
  },
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
  activeEffect.deps.push(deps)
  deps.add(activeEffect)
  console.log('???', deps, key)
}

// 触发更新
function trigger(target, key) {
  const depsMap = bucket.get(target)
  console.log(key, depsMap, target)
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

// effect(
//   () => {
//     const name = obj.ok ? obj.bar : 'not set'
//     console.log('name:', name)
//   }
// ) 

// obj.ok = false
// obj.bar ++

// demo: stack
let temp1, temp2
effect(() => {
  console.log('effect1 run')
  effect(() => {
    console.log('effect2 run', temp2)
    temp2 = obj.bar
  })
  temp1 = obj.foo
})
obj.foo = 2
obj.bar = 2
console.log('bucket:', bucket)