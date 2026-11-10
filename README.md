# 低效用地监管系统

按会议纪要和需求文档实现的低效用地监管场景：四类低效用地（供而未用、用而未尽、金角银边、企业低效）落图、自动归类、动态更新、标准出图。

- 地图：MapLibre GL JS
- 底图：OpenStreetMap 矢量瓦片（OpenFreeMap 提供，OpenMapTiles 结构，无需密钥），按设计语言重新配色，中文注记优先
- 前端：Vue 3 + Vite
- 后端：Node.js + Express，数据库用 Node 内置 SQLite（`node:sqlite`，无原生依赖）
- 地块数据：`data/前湾工业用地数据库.shp`（CGCS2000 经纬度，1206 个地块）

## 运行

需要 Node.js 22.13 以上（开发时用的是 24）。

```bash
npm install
npm run import      # 把 data/ 下的 shapefile 导入 storage/land.db（已导入时自动跳过）
npm run dev         # 前端 http://localhost:5173 ，API http://localhost:3001
```

生产部署：

```bash
npm run build       # 打包到 web/dist
npm start           # 由 API 服务同时托管前端，默认端口 3001（环境变量 API_PORT 可改）
```

数据库位置默认是 `storage/land.db`，可用环境变量 `DB_PATH` 指定。

## GitHub Pages 演示版

推送到 `main` 后，`.github/workflows/pages.yml` 自动构建并发布演示版。演示版没有后端：

- 地块底数在构建时由 `scripts/export-static.js` 从 `data/` 下的 shapefile 生成为 `parcels.json`
- 归类规则、自动重算、金角银边、项目、变更记录等逻辑与后端共用 `shared/service.js`，在浏览器内运行
- 所有修改只保存在当前浏览器（localStorage），其他人看不到；页头“恢复初始数据”可清除
- 使用 hash 路由（地址形如 `…/#/edge`）

本地预览演示版：

```bash
npm run build:pages -- --base /land-demo/
npm run preview:pages -- --base /land-demo/
```

## 代码结构

| 目录 | 内容 |
| --- | --- |
| `shared/` | 归类规则（`rules.js`）和业务逻辑（`service.js`），后端与演示版共用 |
| `server/` | Express 路由、SQLite 存储、shapefile 导入 |
| `web/` | Vue 前端；`web/src/static/` 为演示版的浏览器存储 |
| `scripts/` | 演示版静态数据生成 |

## 页面

| 页面 | 路径 | 功能 |
| --- | --- | --- |
| 一张图 | `/` | 全屏地图 + 浮动面板；四类图层开关、厂中厂标识、已处置历史；按村/项目状态/关键字筛选；圈选范围后统计与清单随之变化；测量；时点回看（按重算快照）；点击地块弹出详情；导出清单 |
| 地块详情 | `/parcel/:id` | 基本信息、建设情况（应建/已建/剩余）、效益指标与归类原因、厂中厂、关联项目、变更历史 |
| 金角银边 | `/edge` | 在地图上绘制或导入 GeoJSON 登记地块；处置状态、受让企业、拟开发内容、牵头人、开工；年度开工率（目标 ≥ 50%）；清单导出 |
| 标准出图 | `/export` | 选图种、范围、数据时点，预览 A3 横版图面；生成 PNG 或打印为 PDF；导出清单 |
| 数据管理 | `/data` | 状态录入（开工标记、建设量、厂中厂承租方）、规则与重算、项目信息、数据对接、变更记录 |

页面右上角可填写操作人姓名，写入每条变更记录。

## 自动归类规则

规则在 `server/rules.js`，阈值在“数据管理 › 规则与重算”中调整，保存后全量重算并生成快照。

| 类型 | 判定 | 主要数据 |
| --- | --- | --- |
| ① 供而未用 | 是否供地 = 是，且开工标记 = 未开工 | `SFGD`、开工标记 |
| ② 用而未尽 | 已开工，且已建面积 < 应建面积 × 比例（默认 67%）；应建 = 规划容积率 × 用地面积 | `GHRJL`、`SJJZMJ`、`GYMJ` |
| ③ 金角银边 | 人工登记，按处置状态管理；“已完成”后移出当前图层并保留历史 | `edges` 表 |
| ④ 企业低效 | 不属于①②，且亩均税收 < 5 万元/亩 **且** 实际容积率 < 0.5（可改为“任一项”） | `亩均税`、`SJRJL` |

导入时的初始开工标记：有实际开工时间、实际竣工时间或已有建筑面积，记为已开工。土地权利人（`TDQLR`）与使用权利人（`权利人`）不一致的地块，标为“疑似厂中厂，待核实”。

默认阈值是初始值，会议没有给出具体数，需要业务部门确认后调整。

## 当前数据情况（导入后）

- 供而未用 8 块，用而未尽 266 块，企业低效 119 块（默认阈值）
- 537 块已开工但缺规划容积率，无法判断是否用而未尽
- 114 块疑似厂中厂
- 原始数据里没有金角银边地块，需要在系统里绘制或导入；也没有农转用报批数据，“批而未供”图层暂未实现

## 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/parcels` | 全部地块 GeoJSON（含归类和关键指标） |
| GET / PATCH | `/api/parcels/:id` | 地块详情；更新开工、建设量、厂中厂 → 自动重算 |
| GET | `/api/stats` | 四类统计、金角银边进度、项目统计 |
| GET / PUT | `/api/rules` | 判定阈值 |
| POST | `/api/recalc` | 手动全量重算 |
| GET | `/api/snapshots`、`/api/snapshots/:id` | 重算快照 |
| GET / POST / PATCH / DELETE | `/api/edges`、`/api/edges/:id` | 金角银边 |
| POST | `/api/edges/import` | 导入 GeoJSON |
| GET / POST / PATCH | `/api/projects`、`/api/projects/:id` | 项目 |
| GET | `/api/changes`、`/api/sources` | 变更记录、数据源状态 |
| GET | `/api/export/parcels.csv?cls=gwy,ywj` 或 `?ids=1,2` | 清单导出（UTF-8 BOM，Excel 可直接打开） |

## 尚未实现

- 用户登录与按部门的权限控制（目前任何能访问的人都能修改，操作人姓名由使用者自己填写）
- 卷帘对比、批而未供图层（缺报批数据）
- 小程序月度评估（P2）
- 底图依赖外网访问 `tiles.openfreemap.org`；部署到政务内网时需要自建 OSM 矢量瓦片服务，并修改 `web/src/map/basemap.js` 中的 `STYLE_URL`
