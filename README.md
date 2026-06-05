# Soccercard

命中球缘 H5 原型：用基础出生信息和自选球风生成你的本命球员画像，输出可下载、可转发的球员结果卡。

## Preview

Online:

```text
https://de1zyeu.tech/soccercard/
```

Library:

```text
https://de1zyeu.tech/soccercard/library
```

Open locally:

```text
prototype/football-real-preview/index.html
```

Direct gallery view:

```text
prototype/football-real-preview/index.html?gallery=1&internal=1
```

Direct result demo:

```text
prototype/football-real-preview/index.html?auto=1
```

## Project Structure

```text
PRD/
  产品动线、96 球员清单、命理映射规则
assets/generated/
  football-flow-v1/                 flow concept reference
  player-archetypes-v1/             96 generated player archetype images
prototype/
  football-flow/                    earlier flow prototype
  football-real-preview/            current local preview
```

## Current Prototype

- 96 个命中球缘画像库
- 16 张分页浏览
- 本地 `file://` 和 GitHub Pages 均可运行
- 只保存结果层，不保存原始出生输入
- 结果页绑定真实生成素材和球员人设文案
