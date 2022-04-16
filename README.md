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
我们就需要修改 activeEffect 的架构 并且引入副作用栈 effectStack
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
解决办法很简单：trigger 时判断要执行的副作用函数是不是和 activeEffect 相同，相同则不执行
7. Step7: 调度执行.
可调度性是响应式系统中非常重要的特性。所谓可调度性：是指 trigger 时触发副作用函数的执行时，有能力决定`副作用函数执行的时机、次数以及方式`。具体体现：用一个微任务队列装载要执行的任务，去重且一次执行。这个功能点与 Vue.js 连续多次修改响应式数据但只会触发一次相似，Vuejs 中实现了一个更加完善的调度器，思路与这里差不多。
## 参考
《Vue.js 设计与实现》