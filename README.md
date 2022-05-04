## 相关概念

1. 副作用函数：会产生副作用的函数。比如函数内改变 DOM 或者外部的变量。
2. 响应式数据：副作用函数 effect 设置元素的 innerText 为 obj.text, 当 obj.text 的值发生变化，effect 副作用函数重新执行，那么这个 obj 我们称为响应式数据。

## 一步一步建立响应式
1. Step1: 
  - 简单的利用 `Proxy` 的 `get` `set` 配合 `effect` 函数实现简单的响应式 DEMO
  - 缺陷：直接通过 `effect` 来获取副作用函数，这种硬编码不灵活。
2. Step2: 
  - 用 `effect` 和一个全局变量 `activeEffect` 记录用户传入的`副作用函数` 来解决前面的问题
  - 缺陷：用户修改了之前没有的属性，也就是跟用户传入的 `副作用函数`无关的数据改变了也会触发
  - 新需求: 将对象属性与 `副作用函数` 绑定
3. Step3:
  - 项目当中肯定不止一个对象，那么 `bucket` 用 `WeakMap` 替代 `Set`. `WeakMap` 于 `Map` 的区别在于 `WeakMap` 对 `key` 是弱引用，不影响垃圾回收器的工作。所以一旦被垃圾回收器回收，那么对应的键和值都访问不到了。所有 `WeakMap` 经常用于存储哪些只有当 `key` 所引用的对象存在时（没有被回收）才有价值的信息
  - 封装了 `track` & `trigger` 函数，也就是收集依赖和派发更新
  - 注意：每次重新调用副作用函数时，都会再次执行 track
4. Step4
分支切换与 cleanup
```js
effect(() => {
  console.log('effect run')
  document.body.innerText = obj.ok ? obj.text : 'text'
})
```
当我们修改 `obj.ok = false` 后，不管 `obj.text` 怎么变，都不应该再触发副作用函数了
基于这个需求，我们需要将副作用函数执行前，将与之关联的依赖集合删除。当副作用函数执行完毕后，会重新根据引用建立联系。
从这个 Step 开始，就比较绕了，所以多看多写几次
这里还涉及到 Set 的遍历时 add + delete 带来的无限循环问题
5. Step5: 
嵌套的 effect & effect 栈
在 Vue3 中呢，组件的渲染 render() 就是在 effect 中调用的，那么嵌套组件就会涉及到 effect 的嵌套调用, 所以我们要把 effect 设计成能嵌套的。
我们就需要修改 activeEffect 的架构 并且引入副作用栈 effectStack，因为函数调用也是栈的形式。
```js
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
```
6. Step6: 避免无线递归循环
现在我们的 effect 中如果有同时读写操作，就会陷入无限循环
```js
effect(() => {
  obj.foo++
})
```
解决办法很简单：trigger 时判断要执行的副作用函数是不是和 activeEffect 相同，相同则不执行。缺陷就是未及时响应这一步值的变化
7. Step7: 调度执行.
可调度性是响应式系统中非常重要的特性。所谓可调度性：是指 trigger 时触发副作用函数的执行时，有能力决定`副作用函数执行的时机、次数以及方式`。具体体现：用一个微任务队列装载要执行的任务，去重且一次执行。这个功能点与 Vue.js 连续多次修改响应式数据但只会触发一次相似，Vuejs 中实现了一个更加完善的调度器，思路与这里差不多。
批量更新？[https://www.zhihu.com/search?type=content&q=Vue%20%E6%89%B9%E9%87%8F%E6%9B%B4%E6%96%B0]
8. 计算属性 computed 与 lazy
以上，已经有了 effect/options/scheduler/track/trigger，我们可以结合起来实现 Vuejs 中非常重要的且特色的功能 —— computed
有以下问题/解决
  - 延迟执行 —— options.lazy 懒执行
  - computed 返回一个值 —— effect 函数返回值 
  - computed 依赖项没改变但多次计算 —— 缓存值
  - 依赖项改变后没更新 —— 调度器中让值 dirty
  - effect 中引用 computed 时，computed 改变没有触发外部 effect 更新 —— 在 computed 内部手动 track 和 trigger 外部 effect
9. watch 的实现原理
本质：观测一个响应式数据，当数据发生变化时通知并执行相应的回调函数。利用了副作用函数重新执行时的可调度性。
`traverse` 方法遍历传入观测的所有属性，收集依赖到 watch 内部的 effect。
注意新老值的交替。
目前实现的一个小 bug 就是: 当 watch 的是复杂数据类型的话，oldValue 和 newValue 是一样的（可能需要深克隆一下）。
https://github1s.com/vuejs/core/blob/HEAD/packages/runtime-core/src/apiWatch.ts
10. watch-immediate 与过期的副作用
immediate 就是我们平常开发常用的选项
过期的副作用是指在 watch 中的回调函数中有异步的结果，新派发的回调会使旧派发的回调失效，避免新结果早于旧结果而导致的结果异常问题。
问题重现:
```js
watch(
  () => obj.bar,
  (val, oldValue) => {
    let delay
    if (val === 3) {
      delay = 500
    } else {
      delay = 300
    }
    delayResult(val, delay).then(res => {
      obj.foo = res
    })
  },
)

watch(
  () => obj.foo,
  val => {
    // should be 4, but got 3
    console.log('obj.foo async change', val)
  },
)

obj.bar++
obj.bar++

function delayResult(value, delay) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(value)
    }, delay)
  })
}
```
解决：暴露一个时机，在回调函数执行之前，有限执行用户通过 onInvalidate 注册的过期回调，这样，用户就有机会在过期回调中将上一次的副作用标记为“过期”，解决竞态问题
## 遇到的问题
### effect 外 track 问题
在 prac-22_5_4 练习中一步步写的时候 发现下面 console.log() 仍然会执行 3 次，我一度认为是我写错了还是哪里顺序搞错了，但是 prac-22_5_3 比较全的代码中并没有出现这个问题啊。
```js
effect(
  () => {
    const name = obj.ok ? obj.bar : 'not set'
    console.log('name:', name)
  }
) 

obj.ok = false
obj.bar ++
```
后来发现是 `obj.bar++` 中再次调用了 obj.bar 造成 track，而此时 activeEffect 仍然是上面那个 effect 函数，而比较全的代码中使用了栈结构，所以在 effect 外 track 是直接在第一行结束返回
### effectFn 重复调用问题
同样是 prac-22_5_4 遇到的问题。发现最后 effect2 run 打印了两次，似乎是内部 effect 中的回调函数没有去重。仔细一看问题出在effect 函数体中，每次调用 effect 即使传入的回调函数 fn 是一样的，但是 `const effectFn = () =>` 却一直是不同的函数，所以没有去重。所以当外部 effectFn 重新执行导致内部 effect 重新执行的话，那么对应内部响应式数据对应的 effectFn 就有两个
```js
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
```
## 参考
《Vue.js 设计与实现》