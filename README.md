# Soccercard

足球命格 H5 原型：用基础出生信息生成“你天生是哪种球场命格”，输出可传播的球员人设结果页。

## Preview

Open locally:

```text
prototype/football-real-preview/index.html
```

Direct gallery view:

```text
prototype/football-real-preview/index.html?gallery=1
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

- 96 个球场命格图库
- 8 / 16 张分页浏览
- 本地 `file://` 可运行
- 只保存 result layer，不保存原始出生输入
- 结果页绑定真实生成素材和球员人设文案
