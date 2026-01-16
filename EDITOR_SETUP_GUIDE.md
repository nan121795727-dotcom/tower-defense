# 编辑器配置指南

## Canvas节点配置

### 必需的组件

Canvas节点上必须添加以下组件（按执行顺序）：

1. **UIBuilder** (必须)
   - 位置：Canvas节点
   - 作用：自动创建所有UI元素
   - 属性配置：
     - Canvas: 留空（会自动查找）
     - Button Sprite: 可选（按钮背景图，留空也可以）
     - Card Bg Sprite: 可选（卡片背景图，留空也可以）
     - Panel Bg Sprite: 可选（面板背景图，留空也可以）

2. **WaveSystem** (必须)
   - 位置：Canvas节点或其子节点
   - 作用：管理波次系统
   - 属性配置：
     - Enemy Prefab: **必须设置**（拖入敌人预制体）
     - Elite Enemy Prefab: 可选
     - Boss Enemy Prefab: 可选
     - Wave Label: 留空（UIBuilder会自动创建）
     - Countdown Label: 留空（UIBuilder会自动创建并连接）

3. **ShopSystem** (必须)
   - 位置：Canvas节点或其子节点
   - 作用：管理商店系统
   - 属性配置：
     - Shop Panel: 留空（UIBuilder会自动创建）
     - Card Container: 留空（UIBuilder会自动创建）
     - Card Prefab: 留空（UIBuilder会自动创建）
     - Refresh Button: 留空（UIBuilder会自动创建）
     - Toggle Button: 留空（UIBuilder会自动创建）

4. **DragDropSystem** (必须)
   - 位置：Canvas节点或其子节点
   - 作用：处理拖拽交互
   - 属性配置：
     - Tower Prefab: **必须设置**（拖入防御塔预制体）
     - Cancel Area: 留空（UIBuilder会自动创建）

5. **TouchManager** (必须)
   - 位置：Canvas节点或其子节点
   - 作用：处理触摸输入
   - 属性配置：
     - Tower Prefab: **必须设置**（拖入防御塔预制体）
     - Main Camera: 可选（会自动查找）
     - Money Label: 留空（UIBuilder会自动创建）

6. **UIController** (必须)
   - 位置：Canvas节点或其子节点
   - 作用：控制UI显示
   - 属性配置：
     - Money Label: 留空（UIBuilder会自动创建）
     - Health Label: 留空（UIBuilder会自动创建）
     - Wave Label: 留空（UIBuilder会自动创建）
     - Countdown Label: 留空（UIBuilder会自动创建）
     - Reset Button: 留空（UIBuilder会自动创建）

### Canvas子节点结构

运行后，Canvas下会自动创建以下节点（由UIBuilder生成）：

- **TopBar** (顶部信息栏)
  - Background (背景)
  - MoneyLabel (金币显示)
  - HealthLabel (生命值显示)
  - WaveLabel (波次显示)
  - CountdownLabel (倒计时显示)

- **ShopPanel** (商店面板)
  - PanelBackground (背景)
  - TitleBar (标题栏)
    - ShopTitle (商店标题)
    - ToggleButton (收起/展开按钮)
  - CardContainer (卡片容器)
    - ShopCard (多个卡片，由ShopSystem动态创建)
  - RefreshButton (刷新按钮)

- **GameOverPanel** (游戏结束面板，初始隐藏)
  - Background (背景)
  - GameOverText (游戏结束文本)
  - ResetButton (重新挑战按钮)

- **CancelArea** (取消区域，初始隐藏)
  - Background (背景)
  - CancelLabel (取消文字)

## 配置步骤

### 步骤1：添加UIBuilder组件

1. 选中Canvas节点
2. 点击"添加组件"按钮
3. 搜索并添加"UIBuilder"组件
4. 所有属性可以留空（会自动查找和创建）

### 步骤2：添加WaveSystem组件

1. 选中Canvas节点（或创建一个子节点，如"GameManager"）
2. 点击"添加组件"按钮
3. 搜索并添加"WaveSystem"组件
4. **重要**：将敌人预制体拖到"Enemy Prefab"属性中

### 步骤3：添加ShopSystem组件

1. 选中Canvas节点（或同一个"GameManager"节点）
2. 点击"添加组件"按钮
3. 搜索并添加"ShopSystem"组件
4. 所有属性可以留空（UIBuilder会自动创建）

### 步骤4：添加DragDropSystem组件

1. 选中Canvas节点（或同一个"GameManager"节点）
2. 点击"添加组件"按钮
3. 搜索并添加"DragDropSystem"组件
4. **重要**：将防御塔预制体拖到"Tower Prefab"属性中

### 步骤5：添加TouchManager组件

1. 选中Canvas节点（或同一个"GameManager"节点）
2. 点击"添加组件"按钮
3. 搜索并添加"TouchManager"组件
4. **重要**：将防御塔预制体拖到"Tower Prefab"属性中

### 步骤6：添加UIController组件

1. 选中Canvas节点（或同一个"GameManager"节点）
2. 点击"添加组件"按钮
3. 搜索并添加"UIController"组件
4. 所有属性可以留空（UIBuilder会自动创建）

## 常见问题

### Q: 为什么看不到TopBar和ShopPanel？

A: 这些节点是由UIBuilder在运行时自动创建的。如果看不到，请检查：
1. UIBuilder组件是否已添加到Canvas
2. UIBuilder组件的Canvas属性是否为空（会自动查找）
3. 控制台是否有错误信息

### Q: 为什么倒计时不显示？

A: 请检查：
1. WaveSystem组件是否已添加
2. WaveSystem的Enemy Prefab是否已设置
3. 控制台是否有"倒计时标签已连接到WaveSystem"的日志
4. 如果没有，可能是查找顺序问题，尝试将WaveSystem直接添加到Canvas节点上

### Q: 为什么商店没有背景？

A: 商店背景由UIBuilder使用Graphics组件绘制。如果看不到，请检查：
1. UIBuilder是否正确执行（查看控制台日志）
2. ShopPanel节点是否已创建（在层级面板中查看）

## 推荐的节点结构

```
Canvas
├── Camera
├── GridMap
├── GameManager (可选，用于组织组件)
│   ├── WaveSystem (组件)
│   ├── ShopSystem (组件)
│   ├── DragDropSystem (组件)
│   ├── TouchManager (组件)
│   └── UIController (组件)
└── UIBuilder (组件，直接添加到Canvas)
```

或者更简单的结构（所有组件都在Canvas上）：

```
Canvas
├── Camera
├── GridMap
├── UIBuilder (组件)
├── WaveSystem (组件)
├── ShopSystem (组件)
├── DragDropSystem (组件)
├── TouchManager (组件)
└── UIController (组件)
```
