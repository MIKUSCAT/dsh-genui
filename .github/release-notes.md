MIKUSCAT 的首个 GenUI 定制版，基于上游 0.15.0。

- 暖白、暖灰和陶土色，统一文字层级、分组间距及窄屏布局。
- 默认不生成装饰性 emoji、眉题或注释小字；简化面板与模板界面。
- 保留图表、表单、本地计算、地图、3D、导出和原有交互格式。

从上游版迁移时，先移除旧插件，再安装本页附件：

```sh
dsh plugin --profile desktop remove @changfenhuang/dsh-genui
dsh plugin --profile desktop add "https://github.com/MIKUSCAT/dsh-genui/releases/latest/download/dsh-genui.tgz"
```

安装后重新打开 DSH。Web 用户将 desktop 换成 web。

`genui-light.html` 和 `genui-dark.html` 是可离线操作的示例。
`SHA256SUMS` 用于校验安装包。源代码与第三方声明保留在仓库中。
