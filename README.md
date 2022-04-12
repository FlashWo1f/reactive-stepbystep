## 一步一步建立响应式
1. Step1: 
  - 做了什么：简单的利用 `Proxy` 的 `get` `set` 配合 `effect` 函数实现简单的响应式 DEMO
  - 缺陷：直接通过 `effect` 来获取副作用函数，这种硬编码不灵活。
2. Step2: 
  - 用 `effect` 和一个全局变量 `activeEffect` 记录用户传入的`副作用函数` 来解决前面的问题
  - 缺陷：用户修改了之前没有的属性，也就是跟用户传入的 `副作用函数`无关的数据改变了也会触发
  - 新需求: 将对象属性与 `副作用函数` 绑定
3. 
## 参考
《Vue.js 设计与实现》