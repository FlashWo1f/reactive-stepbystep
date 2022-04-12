const bucket = new Set()

// 用一个全局变量存储被注册的副作用函数
let activeEffect

const data = {
  text: 'hello world'
}

const obj = new Proxy(data, {
  get(target, key) {
    if (activeEffect) {
      bucket.add(activeEffect)
    }
    return target[key]
  },
  set(target, key, newVal) {
    target[key] = newVal
    bucket.forEach(fn => fn())
    return true
  }
})



// effect 函数用于注册副作用函数
function effect(fn) {
  activeEffect = fn
  fn()
}

effect(() => {
  console.log('effect run') // 打印两次
  document.body.innerText = obj.text
})

setTimeout(() => {
  // 副作用函数中没有读取 notExist 属性的值 所以不应该触发副作用重新执行
  obj.notExist = 'hello vue3'
}, 1000)