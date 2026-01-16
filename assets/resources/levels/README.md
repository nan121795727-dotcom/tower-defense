# 关卡配置说明

## 概述

这个关卡系统允许你通过JSON配置文件来创建关卡，**完全不需要在Cocos Creator编辑器中手动摆放预制体**。

## 如何使用

### 1. 在场景中添加LevelManager组件

在Cocos Creator编辑器中：
1. 选择 `Canvas` 节点
2. 添加组件 `LevelManager`
3. 将 `GridMap` 节点拖拽到 `Grid Map Node` 属性中

### 2. 在GridMap节点上添加LevelLoader组件

1. 选择 `GridMap` 节点
2. 添加组件 `LevelLoader`
3. 将 `Tile` 预制体拖拽到 `Tile Prefab` 属性中
4. 设置 `Grid Size`（默认75，与GridGenerator保持一致）
5. 设置 `Level Config Path`（例如：`levels/level1`）

### 3. 创建关卡配置文件

在 `assets/resources/levels/` 目录下创建JSON文件，例如 `level1.json`：

```json
{
  "id": 1,
  "name": "第一关",
  "initialMoney": 200,
  "initialHealth": 10,
  "layout": [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 2, 2, 2, 2, 2, 2, 2, 2, 0],
    [0, 2, 0, 0, 0, 0, 0, 0, 2, 0],
    [0, 3, 1, 1, 1, 1, 1, 1, 2, 0],
    [0, 2, 0, 0, 0, 0, 0, 0, 2, 0],
    [0, 2, 1, 1, 1, 1, 1, 1, 4, 0],
    [0, 2, 2, 2, 2, 2, 2, 2, 2, 0],
    ...
  ]
}
```

## 布局数字说明

- **0** = VOID（不可放置，通常是边界或障碍物）
- **1** = PATH（路径，敌人行走的路线）
- **2** = EMPTY（空地，可以放置防御塔）
- **3** = START（起点，敌人从这里出现）
- **4** = END（终点，敌人到达这里会扣血）

## 配置字段说明

- `id`: 关卡ID（数字）
- `name`: 关卡名称（字符串）
- `initialMoney`: 初始金币（可选，默认使用GameConfig中的值）
- `initialHealth`: 初始生命值（可选，默认使用GameConfig中的值）
- `layout`: 二维数组，定义地图布局（18行 x 10列）

## 创建新关卡

1. 复制一个现有的关卡JSON文件
2. 修改 `id` 和 `name`
3. 修改 `layout` 数组来设计你的地图
4. 在 `LevelLoader` 的 `Level Config Path` 中设置新关卡的路径

## 注意事项

1. **布局尺寸**：默认是18行 x 10列，可以在代码中修改
2. **路径连通性**：确保从START(3)到END(4)有连续的PATH(1)连接
3. **至少一个起点和终点**：每个关卡必须至少有一个START(3)和一个END(4)
4. **文件位置**：JSON文件必须放在 `assets/resources/levels/` 目录下

## 示例关卡

已包含3个示例关卡：
- `level1.json` - 简单的新手关卡
- `level2.json` - 复杂路径关卡
- `level3.json` - 挑战关卡

## 程序化生成的优势

✅ **无需手动摆放**：所有关卡通过JSON配置自动生成  
✅ **快速迭代**：修改JSON文件即可调整关卡  
✅ **易于管理**：所有关卡配置集中在一个目录  
✅ **版本控制友好**：JSON文件易于版本管理和协作  
✅ **支持多关卡**：轻松创建和管理多个关卡
