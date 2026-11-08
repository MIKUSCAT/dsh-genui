GenUI 0.16：本地分步推演与条件计算。

- 新增 `stepper`：本地前后翻页、阶段跳转、键盘导航，保留已访问控件，并支持保存与离线导出恢复。
- `computed` / `plot` 支持比较、逻辑和 `?:` 条件表达式，短路求值避免未选分支影响当前结果。
- 模板中心新增二分查找和阈值响应；沿用暖灰、陶土色及简洁布局。

已安装 MIKUSCAT 版可直接升级：

```sh
dsh plugin --profile desktop add "https://github.com/MIKUSCAT/dsh-genui/releases/latest/download/dsh-genui.tgz"
```

安装后重新打开 DSH。Web 用户将 desktop 换成 web。

`stepper-light.html`、`threshold-light.html` 是可离线操作的新示例，另附深色版本及预算示例。
`SHA256SUMS` 用于校验安装包。源代码与第三方声明保留在仓库中。
