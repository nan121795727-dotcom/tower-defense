# 快速开始 - 显示商店UI

## 问题：看不到商店UI？

如果你看不到商店UI，请按照以下步骤操作：

## 方法1：使用UIBuilder自动生成（最简单）

### 步骤：

1. **打开Cocos Creator编辑器**

2. **选择Canvas节点**
   - 在层级管理器中找到 `Canvas` 节点
   - 选中它

3. **添加UIBuilder组件**
   - 在属性检查器中，点击"添加组件"
   - 搜索并添加 `UIBuilder` 组件

4. **设置Canvas属性**
   - 在UIBuilder组件中，将 `Canvas` 属性拖拽设置为Canvas节点
   - （其他属性可选，不设置也能工作）

5. **运行游戏**
   - 点击运行按钮
   - 应该能看到：
     - 顶部：金币、生命值、波次显示
     - 底部：商店面板，4张防御塔卡片

## 方法2：手动检查

如果方法1不行，检查以下几点：

### 检查1：UIBuilder是否添加？
- 在Canvas节点上应该有 `UIBuilder` 组件
- 如果没有，添加它

### 检查2：控制台是否有错误？
- 打开控制台（Console）
- 查看是否有红色错误信息
- 如果有，告诉我错误内容

### 检查3：ShopSystem是否正确初始化？
- 在Canvas节点上应该有 `ShopSystem` 组件
- 如果没有，UIBuilder会自动添加
- 检查 `Card Container` 属性是否已设置

### 检查4：UI节点是否存在？
- 在层级管理器中查找：
  - `TopBar` - 顶部信息栏
  - `ShopPanel` - 商店面板
  - `CardContainer` - 卡片容器（在ShopPanel下）
  - 应该有4个 `ShopCard` 节点

## 方法3：强制刷新

如果UI已创建但看不到卡片：

1. **在控制台输入**（如果支持）：
   ```javascript
   // 查找ShopSystem并强制刷新
   const canvas = cc.find("Canvas");
   const shopSystem = canvas.getComponent("ShopSystem");
   if (shopSystem) {
       shopSystem.refreshShop();
   }
   ```

2. **或者修改代码**：
   - 打开 `ShopSystem.ts`
   - 在 `start()` 方法中，确保有 `this.refreshShop()` 调用

## 调试信息

运行游戏后，控制台应该显示：
- "刷新商店..."
- "创建卡片: XXX" (x4)
- "商店刷新完成，生成了 4 张卡片"

如果没有这些信息，说明ShopSystem没有正确初始化。

## 常见问题

### Q: 只看到顶部信息栏，没有商店？
A: 检查ShopPanel节点是否存在，是否被其他UI遮挡

### Q: 看到商店面板，但没有卡片？
A: 检查CardContainer是否存在，ShopSystem是否正确初始化

### Q: 点击卡片没有反应？
A: 检查BuyButton是否正确绑定事件，ShopCard组件是否存在

## 如果还是不行

请告诉我：
1. 控制台有什么错误信息？
2. 层级管理器中能看到哪些UI节点？
3. 是否添加了UIBuilder组件？
4. ShopSystem组件是否存在？

我会根据具体情况帮你解决。
