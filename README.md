# Soccercard

命中球缘 H5 项目。用基础出生信息和自选球风生成球员角色结果卡。

## Folder Structure

```text
requirements/
  Product requirements, copy tables, rules, and research notes.

code/
  soccercard/        Current H5 app.
  football-flow/     Earlier flow prototype.

assets/
  card/              Local-only player-card PNGs and card archive.
  others/            Lightweight tracked assets, radar SVGs, references.
```

## Current App

Open locally:

```text
code/soccercard/index.html
```

Gallery:

```text
code/soccercard/index.html?gallery=1&internal=1
```

Auto result:

```text
code/soccercard/index.html?auto=1
```

## Asset Policy

- Player-card PNGs live locally under `assets/card/player-archetypes-v1/`.
- Player-card PNGs are not tracked in this main repository.
- Public player-card assets live in the separate repo:

```text
https://github.com/de1zyeu123/soccercard-asset
```

- Radar SVGs are lightweight and remain tracked under `assets/others/player-radars-v1/`.

## Source Of Truth

- App data: `code/soccercard/players-data.js`
- Main app logic: `code/soccercard/app.js`
- Current review table: `requirements/球员卡片_名称描述球缘分析清单.md`
