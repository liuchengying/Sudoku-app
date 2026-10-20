1. 为 6 个页面共 9 处 uni.showModal 调用补充 cancelText: '取消'（game/index.vue 3 处、settings/index.vue 2 处、tutorial/daily/levels/import 各 1 处），不改动 confirmText/confirmColor/success 逻辑。
2. docs/validation/validate-ui.cjs 在 SFC 编译检查后追加静态扫描：统计各 .vue 源码中 uni.showModal( 出现次数与 cancelText: 出现次数，逐文件要求前者不大于后者，否则抛错；保持脚本退出码语义不变。
3. 本地跑 typecheck 与 validate-ui 确认后 verify 全部注册检查。
4. 按用户既有授权重启 H5 dev 服务器，在内部浏览器实测设置页导入确认与退出本局弹窗取消按钮文案，截图存 observations；测后停服务器。
5. 会话内逐项复核并 finish 交付。恢复：检查失败保留日志按真实原因修复；不操作 Git。