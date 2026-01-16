# UI设置指南

## 快速开始

### 方法1：自动生成UI（推荐）

1. 在Canvas节点上添加 `UIBuilder` 组件
2. 设置属性：
   - `Canvas`: 拖入Canvas节点
   - （可选）`Button Sprite`: 按钮背景图
   - （可选）`Card Bg Sprite`: 卡片背景图
   - （可选）`Panel Bg Sprite`: 面板背景图
3. 运行游戏，UI会自动生成

### 方法2：手动设置UI

如果你想手动创建UI，请按照以下结构：

## UI结构

### 1. 顶部信息栏 (TopBar)
```
Canvas
└── TopBar
    ├── Background (Sprite, 半透明黑色)
    ├── MoneyLabel (Label, 显示金币)
    ├── HealthLabel (Label, 显示生命值)
    └── WaveLabel (Label, 显示波次)
```

**设置：**
- TopBar: Widget对齐顶部，高度100
- MoneyLabel: 左上角，字体24，金色
- HealthLabel: 左上角，字体24，红色
- WaveLabel: 右上角，字体24，白色

### 2. 商店面板 (ShopPanel)
```
Canvas
└── ShopPanel
    ├── PanelBackground (Sprite, 深色背景)
    ├── ShopTitle (Label, "商店")
    ├── CardContainer (容器，横向排列卡片)
    │   └── ShopCard (x4, 由ShopSystem自动生成)
    └── RefreshButton (Button, 刷新按钮)
        └── RefreshCostLabel (Label, "刷新 (2)")
```

**设置：**
- ShopPanel: Widget对齐底部，高度200
- CardContainer: 横向布局，宽度600，高度140
- RefreshButton: 右下角，宽度120，高度40

### 3. 商店卡片 (ShopCard)
```
ShopCard
├── CardBackground (Sprite, 品质色背景)
├── NameLabel (Label, 防御塔名称，品质色)
├── CostLabel (Label, 价格，金色)
├── DescLabel (Label, 描述，小字)
└── BuyButton (Button, 购买按钮)
    └── Label (Button文本)
```

**设置：**
- ShopCard: 宽度140，高度130
- NameLabel: 顶部，字体18，品质色
- CostLabel: 中部，字体20，金色
- DescLabel: 中上部，字体12，灰色，支持换行
- BuyButton: 底部，宽度120，高度25

### 4. 游戏结束面板 (GameOverPanel)
```
Canvas
└── GameOverPanel (初始隐藏)
    ├── Background (Sprite, 半透明黑色)
    ├── GameOverText (Label, "游戏结束")
    └── ResetButton (Button, "重新开始")
```

**设置：**
- GameOverPanel: 全屏，初始active=false
- GameOverText: 居中，字体48，红色
- ResetButton: 居中，字体24，蓝色

### 5. 待放置提示 (PendingTowerHint)
```
Canvas
└── PendingTowerHint (初始隐藏)
    └── Label (显示"请点击地图放置：XXX")
```

**设置：**
- PendingTowerHint: 屏幕顶部居中，初始active=false
- Label: 字体20，黄色，提示文字

## 组件绑定

### UIController
在Canvas上添加 `UIController` 组件，绑定：
- `Money Label`: TopBar/MoneyLabel
- `Health Label`: TopBar/HealthLabel
- `Wave Label`: TopBar/WaveLabel
- `Reset Button`: GameOverPanel/ResetButton
- `Pending Tower Hint`: PendingTowerHint节点

### ShopSystem
在Canvas上添加 `ShopSystem` 组件，绑定：
- `Shop Panel`: ShopPanel节点
- `Card Container`: ShopPanel/CardContainer节点
- `Card Prefab`: 商店卡片预制体（可选，如果不提供会自动创建）
- `Refresh Button`: ShopPanel/RefreshButton
- `Refresh Cost Label`: RefreshButton/RefreshCostLabel

### WaveSystem
在Canvas上添加 `WaveSystem` 组件，绑定：
- `Enemy Prefab`: 敌人预制体
- `Wave Label`: TopBar/WaveLabel（与UIController共用）

## 颜色配置

### 品质颜色
- **白色**: RGB(255, 255, 255)
- **绿色**: RGB(50, 255, 50)
- **蓝色**: RGB(50, 150, 255)

### UI颜色
- **金币**: RGB(255, 215, 0) - 金色
- **生命值**: RGB(255, 50, 50) - 红色
- **波次**: RGB(255, 255, 255) - 白色
- **按钮正常**: RGB(50, 200, 50) - 绿色
- **按钮悬停**: RGB(80, 230, 80) - 浅绿色
- **按钮按下**: RGB(20, 170, 20) - 深绿色
- **背景**: RGB(30, 30, 30, 220) - 深灰半透明

## 字体大小

- **标题**: 28-32
- **主要信息**: 24
- **次要信息**: 18-20
- **描述文字**: 12-14
- **按钮文字**: 16-24

## 注意事项

1. **自动生成**: 如果使用UIBuilder，所有UI会自动创建，无需手动设置
2. **Widget对齐**: 所有UI元素使用Widget组件进行对齐，适配不同屏幕
3. **品质显示**: 防御塔名称和卡片背景会根据品质自动变色
4. **按钮状态**: 购买按钮会根据金币自动启用/禁用
5. **波次显示**: 波次标签会显示当前波次/总波次，精英波和Boss波会有特殊标记

## 测试

运行游戏后检查：
1. ✅ 顶部显示金币、生命值、波次
2. ✅ 底部显示商店，4张卡片
3. ✅ 点击卡片可以购买
4. ✅ 点击刷新按钮可以刷新商店
5. ✅ 购买后显示待放置提示
6. ✅ 游戏结束时显示重置按钮
