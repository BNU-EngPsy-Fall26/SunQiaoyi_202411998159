# 正式数据分析

`final-analysis.cjs` 使用 README 中事前确定的清理规则重新计算正式结果。脚本只依赖 Node.js 内置模块，不需要安装第三方包，也不需要下载密钥。

## 直接读取匿名课程接口

在仓库根目录运行：

```bash
npm run analyze
```

脚本读取项目 `CUPX8L` 的三个正式实验，保留每名匿名被试最后一条完整记录，并生成 `analysis/final-summary.json`。

## 使用本地导出文件

若需要锁定某次下载的原始版本，可以传入课程后台导出的 JSON：

```bash
node analysis/final-analysis.cjs --input D:/path/to/export.json --output analysis/final-summary.json
```

也可以传入一个目录。目录中应包含以下三个文件，每个文件均为对应接口返回的 JSON：

```text
flanker_grouping.json
visual_search_grouping.json
graphical_perception_guides.json
```

下载密钥和含有原始昵称的私有导出文件不要提交到 Git。

## 清理与统计规则

- 同一匿名编号重复完成时保留最后一条完整记录。
- Flanker 和视觉搜索只用正确且反应时不低于 150 ms 的试次计算反应时。
- 单个实验正确率低于 60% 的被试不进入该实验的主要反应时分析。
- 图形判断中低于 300 ms 的试次不进入主要分析，失焦试次单独计数。
- 所有效应先按被试计算，再对被试内差值进行双侧单样本 t 检验。
- 输出 95% t 置信区间和 Cohen's dz。

`final-summary.json` 保存数据质量指标、主要结果、H1–H9 的辅助结果和匿名被试级指标。网页中的公开数字由该文件复核，原始试次不会写入结果网页。
