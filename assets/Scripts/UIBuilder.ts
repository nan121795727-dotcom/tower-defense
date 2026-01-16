import { _decorator, Component, Node, Widget, UITransform, Sprite, Color, Label, Button, SpriteFrame, find, instantiate, Prefab, v3, size, Graphics, director } from 'cc';
import { ShopSystem } from './ShopSystem';
import { TowerConfig, TowerRarity } from './TowerType';
import { DragDropSystem } from './DragDropSystem';
import { TouchManager } from './TouchManager';
import { WaveSystem } from './WaveSystem';
import { GameConfig } from './GameConfig';
import { UIController } from './UIController';

const { ccclass, property } = _decorator;

/**
 * UI构建器
 * 自动创建所有游戏UI元素（中文版本，移动端优化）
 */
@ccclass('UIBuilder')
export class UIBuilder extends Component {
    @property(Node) public canvas: Node = null!;
    @property(SpriteFrame) public buttonSprite: SpriteFrame = null!;
    @property(SpriteFrame) public cardBgSprite: SpriteFrame = null!;
    @property(SpriteFrame) public panelBgSprite: SpriteFrame = null!;

    start() {
        console.log("=== UIBuilder.start() 被调用 ===");
        if (!this.canvas) {
            this.canvas = find("Canvas");
        }
        if (this.canvas) {
            console.log("UIBuilder: Canvas已找到，开始构建UI");
            this.buildAllUI();
            console.log("=== UIBuilder UI构建完成 ===");
        } else {
            console.error("UIBuilder: 未找到Canvas节点！请确保UIBuilder组件已添加到Canvas节点上");
        }
    }

    /**
     * 构建所有UI
     */
    buildAllUI() {
        console.log("UIBuilder: 开始构建所有UI");
        
        // 检查是否已经存在TopBar（避免重复创建）
        const existingTopBar = find("Canvas/TopBar");
        if (existingTopBar) {
            console.warn("UIBuilder: TopBar已存在，跳过创建。如果UI显示异常，请删除现有的TopBar节点");
            return;
        }
        
        // 1. 创建顶部信息栏
        console.log("UIBuilder: 创建TopBar");
        this.createTopBar();
        
        // 2. 创建商店UI（可收起/展开）
        console.log("UIBuilder: 创建ShopPanel");
        this.createShopUI();
        
        // 3. 创建游戏结束UI（失败）
        console.log("UIBuilder: 创建GameOverPanel");
        this.createGameOverUI();
        
        // 4. 创建胜利结算UI
        console.log("UIBuilder: 创建VictoryPanel");
        this.createVictoryUI();
        
        // 5. 创建取消区域（用于拖拽取消）
        console.log("UIBuilder: 创建CancelArea");
        this.createCancelArea();
        
        // 6. 连接UI组件到控制器
        console.log("UIBuilder: 连接UI组件");
        this.connectUIComponents();
        
        console.log("UIBuilder: 所有UI构建完成");
    }
    
    /**
     * 连接UI组件到各个控制器
     * 延迟执行，确保WaveSystem已经初始化
     */
    private connectUIComponents() {
        // 延迟执行，确保WaveSystem已经初始化
        this.scheduleOnce(() => {
            const topBar = find("Canvas/TopBar");
            if (!topBar) {
                console.warn("TopBar未找到，无法连接组件");
                return;
            }
            
            // 新结构：CountdownLabel在CenterArea下
            const centerArea = topBar.getChildByName("CenterArea");
            const countdownNode = centerArea?.getChildByName("CountdownLabel");
            
            if (countdownNode) {
                const countdownLabel = countdownNode.getComponent(Label);
                if (countdownLabel) {
                    // 查找WaveSystem
                    let waveSystem = this.canvas.getComponent(WaveSystem) || 
                                    this.canvas.getComponentInChildren(WaveSystem);
                    
                    if (waveSystem) {
                        waveSystem.countdownLabel = countdownLabel;
                        console.log("倒计时标签已连接到WaveSystem");
                    }
                }
            }
        }, 0.2);
    }

    /**
     * 创建顶部信息栏（金币、生命值、波次、倒计时）
     */
    private createTopBar() {
        console.log("UIBuilder: 开始创建TopBar");
        const TOP_BAR_HEIGHT = 70;  // 增加高度，适应移动端刘海屏
        const PANEL_WIDTH = 750;
        
        const topBar = new Node("TopBar");
        this.canvas.addChild(topBar);
        topBar.setSiblingIndex(998);  // 高层级
        
        const transform = topBar.addComponent(UITransform);
        transform.setContentSize(PANEL_WIDTH, TOP_BAR_HEIGHT);
        
        const widget = topBar.addComponent(Widget);
        widget.isAlignTop = true;
        widget.top = 0;
        widget.isAlignLeft = true;
        widget.isAlignRight = true;
        widget.left = 0;
        widget.right = 0;
        widget.alignMode = Widget.AlignMode.ALWAYS;

        // 背景（顶部渐变黑，增加可读性）
        const bg = new Node("Background");
        topBar.addChild(bg);
        bg.setSiblingIndex(0);
        const bgTransform = bg.addComponent(UITransform);
        bgTransform.setContentSize(PANEL_WIDTH, TOP_BAR_HEIGHT);
        const graphics = bg.addComponent(Graphics);
        // 顶部黑色渐变到透明
        graphics.fillColor = new Color(0, 0, 0, 200);
        graphics.rect(-PANEL_WIDTH/2, -TOP_BAR_HEIGHT/2, PANEL_WIDTH, TOP_BAR_HEIGHT);
        graphics.fill();
        
        // 底部装饰线
        graphics.strokeColor = new Color(255, 215, 0, 100); // 淡金色
        graphics.lineWidth = 1;
        graphics.moveTo(-PANEL_WIDTH/2, -TOP_BAR_HEIGHT/2);
        graphics.lineTo(PANEL_WIDTH/2, -TOP_BAR_HEIGHT/2);
        graphics.stroke();

        // === 左侧区域：资源信息 ===
        const leftArea = new Node("LeftArea");
        topBar.addChild(leftArea);
        leftArea.setPosition(v3(-PANEL_WIDTH/2 + 120, -5, 0));
        
        // 金币胶囊背景
        const moneyBg = this.createCapsuleBg("MoneyBg", 110, 36, new Color(0, 0, 0, 150), new Color(255, 215, 0, 200));
        leftArea.addChild(moneyBg);
        moneyBg.setPosition(v3(-60, 0, 0));

        // 金币（带图标）
        const moneyNode = this.createLabel("MoneyLabel", "200", 22, new Color(255, 235, 100));
        moneyBg.addChild(moneyNode);
        moneyNode.setPosition(v3(10, 0, 0)); // 偏移避开图标
        const moneyLabel = moneyNode.getComponent(Label)!;
        moneyLabel.enableOutline = true;
        moneyLabel.outlineColor = new Color(50, 40, 0, 255);
        moneyLabel.outlineWidth = 1.5;

        // 金币图标
        const coinIcon = this.createLabel("Icon", "💰", 24, Color.WHITE);
        moneyBg.addChild(coinIcon);
        coinIcon.setPosition(v3(-35, 2, 0));

        // 生命胶囊背景
        const healthBg = this.createCapsuleBg("HealthBg", 100, 36, new Color(0, 0, 0, 150), new Color(255, 80, 80, 200));
        leftArea.addChild(healthBg);
        healthBg.setPosition(v3(60, 0, 0));

        // 生命值（带图标）
        const healthNode = this.createLabel("HealthLabel", "10", 22, new Color(255, 120, 120));
        healthBg.addChild(healthNode);
        healthNode.setPosition(v3(10, 0, 0));
        const healthLabel = healthNode.getComponent(Label)!;
        healthLabel.enableOutline = true;
        healthLabel.outlineColor = new Color(60, 10, 10, 255);
        healthLabel.outlineWidth = 1.5;

        // 生命图标
        const heartIcon = this.createLabel("Icon", "❤️", 22, Color.WHITE);
        healthBg.addChild(heartIcon);
        heartIcon.setPosition(v3(-30, 2, 0));

        // === 中间区域：状态/倒计时 ===
        const centerArea = new Node("CenterArea");
        topBar.addChild(centerArea);
        centerArea.setPosition(v3(0, -15, 0)); // 稍微下移，不要贴顶
        
        // 倒计时/状态标签 (加大字号，更醒目)
        const countdownNode = this.createLabel("CountdownLabel", "⏳ 备战 15s", 20, new Color(200, 255, 200));
        centerArea.addChild(countdownNode);
        const countdownLabel = countdownNode.getComponent(Label)!;
        countdownLabel.enableOutline = true;
        countdownLabel.outlineColor = new Color(0, 50, 0, 200);
        countdownLabel.outlineWidth = 2;

        // === 右侧区域：波次 ===
        const rightArea = new Node("RightArea");
        topBar.addChild(rightArea);
        rightArea.setPosition(v3(PANEL_WIDTH/2 - 80, -5, 0));
        
        // 波次背景
        const waveBg = this.createCapsuleBg("WaveBg", 120, 36, new Color(0, 0, 0, 150), new Color(100, 200, 255, 200));
        rightArea.addChild(waveBg);
        
        // 波次图标
        const waveIcon = this.createLabel("Icon", "⚔️", 20, Color.WHITE);
        waveBg.addChild(waveIcon);
        waveIcon.setPosition(v3(-40, 2, 0));

        // 波次显示（简化格式：X/30）
        const waveNode = this.createLabel("WaveLabel", "1/30", 20, new Color(200, 240, 255));
        waveBg.addChild(waveNode);
        waveNode.setPosition(v3(5, 0, 0));
        const waveLabel = waveNode.getComponent(Label)!;
        waveLabel.enableOutline = true;
        waveLabel.outlineColor = new Color(0, 30, 60, 255);
        waveLabel.outlineWidth = 1.5;
        
        console.log("UIBuilder: TopBar创建完成");
    }

    /**
     * 辅助方法：创建胶囊背景
     */
    private createCapsuleBg(name: string, width: number, height: number, fillColor: Color, strokeColor: Color): Node {
        const node = new Node(name);
        const transform = node.addComponent(UITransform);
        transform.setContentSize(width, height);
        const g = node.addComponent(Graphics);
        g.fillColor = fillColor;
        g.roundRect(-width/2, -height/2, width, height, height/2);
        g.fill();
        g.strokeColor = strokeColor;
        g.lineWidth = 2;
        g.roundRect(-width/2, -height/2, width, height, height/2);
        g.stroke();
        return node;
    }

    /**
     * 创建商店UI（可收起/展开，类似炉石手牌）
     */
    private createShopUI() {
        const PANEL_HEIGHT = 220;  // 增加高度，卡片更大
        const COLLAPSED_HEIGHT = 10;
        const PANEL_WIDTH = 750;
        const LEFT_TITLE_WIDTH = 50;  // 左侧标题宽度
        
        // 商店面板
        const shopPanel = new Node("ShopPanel");
        this.canvas.addChild(shopPanel);
        shopPanel.setSiblingIndex(999);
        
        const panelTransform = shopPanel.addComponent(UITransform);
        panelTransform.setContentSize(PANEL_WIDTH, PANEL_HEIGHT);
        
        const panelWidget = shopPanel.addComponent(Widget);
        panelWidget.isAlignBottom = true;
        panelWidget.bottom = 0;
        panelWidget.isAlignLeft = true;
        panelWidget.isAlignRight = true;
        panelWidget.left = 0;
        panelWidget.right = 0;
        panelWidget.alignMode = Widget.AlignMode.ALWAYS;

        // 面板背景 (磨砂玻璃质感)
        const panelBg = new Node("PanelBackground");
        shopPanel.addChild(panelBg);
        panelBg.setSiblingIndex(0);
        const bgTransform = panelBg.addComponent(UITransform);
        bgTransform.setContentSize(PANEL_WIDTH, PANEL_HEIGHT);
        const graphics = panelBg.addComponent(Graphics);
        
        // 主背景 (深蓝灰色)
        graphics.fillColor = new Color(20, 24, 35, 245);
        // 上方圆角
        graphics.roundRect(-PANEL_WIDTH/2, -PANEL_HEIGHT/2, PANEL_WIDTH, PANEL_HEIGHT, 15);
        graphics.fill();
        
        // 顶部高光条 (金色流光)
        graphics.strokeColor = new Color(255, 215, 0, 150);
        graphics.lineWidth = 3;
        graphics.moveTo(-PANEL_WIDTH/2, PANEL_HEIGHT/2);
        graphics.lineTo(PANEL_WIDTH/2, PANEL_HEIGHT/2);
        graphics.stroke();
        
        // 左侧区域（商店标题 - 竖排）
        const leftArea = new Node("LeftArea");
        shopPanel.addChild(leftArea);
        leftArea.setPosition(v3(-PANEL_WIDTH/2 + LEFT_TITLE_WIDTH/2 + 10, 0, 0));
        
        // 标题背景
        const leftBg = leftArea.addComponent(Graphics);
        leftBg.fillColor = new Color(0, 0, 0, 100);
        leftBg.roundRect(-20, -80, 40, 160, 10);
        leftBg.fill();
        
        const titleText = this.createLabel("ShopTitleText", "商\n店", 24, new Color(255, 220, 100));
        leftArea.addChild(titleText);
        const titleLabel = titleText.getComponent(Label)!;
        titleLabel.lineHeight = 30;
        titleLabel.enableOutline = true;
        titleLabel.outlineColor = new Color(50, 30, 0, 255);
        titleLabel.outlineWidth = 2;

        // 拖拽提示文本（纵向，在商店标题右侧）
        const dragHintText = this.createLabel("DragHintText", "拖\n拽\n放\n置", 14, new Color(180, 180, 180, 200));
        leftArea.addChild(dragHintText);
        dragHintText.setPosition(v3(35, 0, 0));
        const dragHintLabel = dragHintText.getComponent(Label)!;
        dragHintLabel.lineHeight = 18;
        dragHintLabel.enableOutline = true;
        dragHintLabel.outlineColor = new Color(0, 0, 0, 150);
        dragHintLabel.outlineWidth = 1;

        // 收起/展开按钮（放在中间上方）
        const toggleBtn = this.createStyledButton("ToggleButton", "▼", 60, 30, 18);
        shopPanel.addChild(toggleBtn);
        toggleBtn.setPosition(v3(0, PANEL_HEIGHT/2 + 15, 0)); // 悬浮在面板上方

        // 卡片容器（在左侧标题和右侧刷新按钮之间居中）
        // 左侧标题占用约70像素，右侧刷新按钮占用约100像素
        // 中心偏移 = (70 - 100) / 2 = -15
        const cardContainer = new Node("CardContainer");
        shopPanel.addChild(cardContainer);
        cardContainer.setPosition(v3(-15, -5, 0)); 
        const containerTransform = cardContainer.addComponent(UITransform);
        containerTransform.setContentSize(560, 180);

        // 刷新按钮（右侧大圆形按钮）
        const refreshBtn = this.createRefreshButton("RefreshButton", "刷新", 80, 80);
        shopPanel.addChild(refreshBtn);
        refreshBtn.setPosition(v3(PANEL_WIDTH/2 - 60, 0, 0));

        console.log("UIBuilder: 商店UI创建完成");

        // 设置ShopSystem引用
        const shopSystem = this.canvas.getComponent(ShopSystem) || this.canvas.addComponent(ShopSystem);
        (shopSystem as any).shopPanel = shopPanel;
        (shopSystem as any).cardContainer = cardContainer;
        (shopSystem as any).cardPrefab = null;
        (shopSystem as any).refreshButton = refreshBtn.getComponent(Button);
        (shopSystem as any).toggleButton = toggleBtn.getComponent(Button);
        (shopSystem as any).refreshCostLabel = null;
        (shopSystem as any).expandedHeight = PANEL_HEIGHT;
        (shopSystem as any).collapsedHeight = COLLAPSED_HEIGHT;
        
        // 确保WaveSystem存在（如果没有手动挂载，则自动添加）
        let waveSystem = this.canvas.getComponent(WaveSystem) || this.canvas.getComponentInChildren(WaveSystem);
        if (!waveSystem) {
            console.log("UIBuilder: WaveSystem未找到，自动添加到Canvas");
            waveSystem = this.canvas.addComponent(WaveSystem);
        }
        // 连接ShopSystem到WaveSystem
        (shopSystem as any).waveSystem = waveSystem;
        
        // 设置DragDropSystem引用
        const dragDropSystem = this.canvas.getComponent(DragDropSystem) || this.canvas.addComponent(DragDropSystem);
        const touchManager = this.canvas.getComponentInChildren(TouchManager);
        if (touchManager && (touchManager as any).towerPrefab) {
            (dragDropSystem as any).towerPrefab = (touchManager as any).towerPrefab;
        }
        
        // 延迟刷新商店
        this.scheduleOnce(() => {
            if (shopSystem && (shopSystem as any).refreshShop) {
                (shopSystem as any).refreshShop();
            }
        }, 0.1);
    }
    
    /**
     * 创建刷新按钮（圆形大按钮）
     */
    private createRefreshButton(name: string, text: string, width: number, height: number): Node {
        const btn = new Node(name);
        const btnTransform = btn.addComponent(UITransform);
        btnTransform.setContentSize(width, height);
        
        const g = btn.addComponent(Graphics);
        // 圆形背景
        g.fillColor = new Color(60, 70, 100, 255);
        g.circle(0, 0, width/2);
        g.fill();
        // 边框
        g.strokeColor = new Color(100, 120, 160, 255);
        g.lineWidth = 3;
        g.circle(0, 0, width/2);
        g.stroke();
        
        // 图标
        const icon = this.createLabel("Icon", "🔄", 28, Color.WHITE);
        btn.addChild(icon);
        icon.setPosition(v3(0, 15, 0));
        
        // 刷新次数（CostLabel 用于动态更新）
        const costLabel = this.createLabel("CostLabel", "剩余2次", 11, new Color(200, 200, 200));
        btn.addChild(costLabel);
        costLabel.setPosition(v3(0, -8, 0));
        
        // 每波重置提示
        const hintLabel = this.createLabel("HintLabel", "每波重置", 9, new Color(150, 150, 150, 180));
        btn.addChild(hintLabel);
        hintLabel.setPosition(v3(0, -22, 0));
        
        btn.addComponent(Button);
        return btn;
    }

    /**
     * 创建商店卡片预制体结构（现代卡牌风格）
     */
    private createShopCardPrefab(): Node {
        const card = new Node("ShopCard");
        const cardTransform = card.addComponent(UITransform);
        cardTransform.setContentSize(130, 180); // 瘦高比例

        // 卡片底板
        const bg = new Node("CardBackground");
        card.addChild(bg);
        const bgTransform = bg.addComponent(UITransform);
        bgTransform.setContentSize(130, 180);
        const bgGraphics = bg.addComponent(Graphics);
        // 深色底
        bgGraphics.fillColor = new Color(30, 30, 40, 255);
        bgGraphics.roundRect(-65, -90, 130, 180, 8);
        bgGraphics.fill();
        
        // 品质边框 (名为CardBorder，逻辑中会修改颜色)
        const border = new Node("CardBorder");
        card.addChild(border);
        const borderG = border.addComponent(Graphics);
        borderG.strokeColor = Color.WHITE; // 默认，会被覆盖
        borderG.lineWidth = 3;
        borderG.roundRect(-65, -90, 130, 180, 8);
        borderG.stroke();

        // 顶部图片区域背景
        const imgBg = new Node("ImgBg");
        card.addChild(imgBg);
        imgBg.setPosition(v3(0, 20, 0));
        const imgG = imgBg.addComponent(Graphics);
        imgG.fillColor = new Color(20, 20, 25, 255);
        imgG.roundRect(-55, -55, 110, 110, 4);
        imgG.fill();

        // 防御塔图标占位
        const icon = new Node("TowerIcon");
        card.addChild(icon);
        icon.setPosition(v3(0, 20, 0));
        const iconSprite = icon.addComponent(Sprite);
        icon.addComponent(UITransform).setContentSize(80, 80);

        // 名称（底部上方）
        const nameLabel = this.createLabel("NameLabel", "防御塔", 16, Color.WHITE);
        card.addChild(nameLabel);
        nameLabel.setPosition(v3(0, -45, 0));
        const nl = nameLabel.getComponent(Label)!;
        nl.enableOutline = true;
        nl.outlineWidth = 1;

        // 价格区域（底部胶囊）
        const priceArea = new Node("PriceArea");
        card.addChild(priceArea);
        priceArea.setPosition(v3(0, -70, 0));
        
        const priceBg = priceArea.addComponent(Graphics);
        priceBg.fillColor = new Color(0, 0, 0, 150);
        priceBg.roundRect(-40, -12, 80, 24, 12);
        priceBg.fill();
        
        const costLabel = this.createLabel("CostLabel", "30", 16, new Color(255, 215, 0));
        priceArea.addChild(costLabel);
        costLabel.setPosition(v3(0, 0, 0)); // 居中

        // 描述（隐藏或精简，这里暂时隐藏，太占地）
        const descLabel = this.createLabel("DescLabel", "", 10, Color.GRAY);
        card.addChild(descLabel);
        descLabel.active = false; // 移动端卡片太小，描述放不下，建议长按显示详情

        // 已购买遮罩
        const purchasedMask = new Node("PurchasedMask");
        card.addChild(purchasedMask);
        purchasedMask.active = false;
        const maskG = purchasedMask.addComponent(Graphics);
        maskG.fillColor = new Color(0, 0, 0, 180);
        maskG.roundRect(-65, -90, 130, 180, 8);
        maskG.fill();
        const soldText = this.createLabel("SoldText", "已拥有", 24, Color.RED);
        purchasedMask.addChild(soldText);

        return card;
    }

    /**
     * 创建取消区域（右上角，便于右手操作）
     */
    private createCancelArea() {
        const cancelArea = new Node("CancelArea");
        this.canvas.addChild(cancelArea);
        
        const transform = cancelArea.addComponent(UITransform);
        transform.setContentSize(120, 120);
        
        const widget = cancelArea.addComponent(Widget);
        widget.isAlignTop = true;
        widget.top = -150;
        widget.isAlignRight = true;
        widget.right = 15;

        // 背景（半透明红色）
        const bg = new Node("Background");
        cancelArea.addChild(bg);
        bg.setSiblingIndex(0);  // 确保背景在最底层
        const bgTransform = bg.addComponent(UITransform);
        bgTransform.setContentSize(120, 120);
        const bgWidget = bg.addComponent(Widget);
        bgWidget.isAlignTop = true;
        bgWidget.isAlignBottom = true;
        bgWidget.isAlignLeft = true;
        bgWidget.isAlignRight = true;
        bgWidget.top = 0;
        bgWidget.bottom = 0;
        bgWidget.left = 0;
        bgWidget.right = 0;
        bgWidget.alignMode = Widget.AlignMode.ALWAYS;
        const bgSprite = bg.addComponent(Sprite);
        bgSprite.type = Sprite.Type.SIMPLE;  // 使用简单类型，可以显示纯色
        bgSprite.color = new Color(255, 100, 100, 100);

        // 文字提示
        const label = this.createLabel("CancelLabel", "取消", 20, new Color(255, 255, 255));
        cancelArea.addChild(label);
        const labelWidget = label.addComponent(Widget);
        labelWidget.isAlignTop = true;
        labelWidget.isAlignBottom = true;
        labelWidget.isAlignLeft = true;
        labelWidget.isAlignRight = true;

        // 设置DragDropSystem引用
        const dragDropSystem = this.canvas.getComponent(DragDropSystem) || this.canvas.addComponent(DragDropSystem);
        (dragDropSystem as any).cancelArea = cancelArea;
        
        // 确保towerPrefab已设置
        if (!(dragDropSystem as any).towerPrefab) {
            const touchManager = this.canvas.getComponentInChildren(TouchManager);
            if (touchManager && (touchManager as any).towerPrefab) {
                (dragDropSystem as any).towerPrefab = (touchManager as any).towerPrefab;
            }
        }
    }

    /**
     * 创建游戏结束UI
     */
    private createGameOverUI() {
        const gameOverPanel = new Node("GameOverPanel");
        this.canvas.addChild(gameOverPanel);
        gameOverPanel.active = false;
        // 确保游戏结束面板在最顶层（高于商店999）
        gameOverPanel.setSiblingIndex(99999);

        const panelTransform = gameOverPanel.addComponent(UITransform);
        panelTransform.setContentSize(750, 1334);

        const panelWidget = gameOverPanel.addComponent(Widget);
        panelWidget.isAlignTop = true;
        panelWidget.isAlignBottom = true;
        panelWidget.isAlignLeft = true;
        panelWidget.isAlignRight = true;
        panelWidget.top = 0;
        panelWidget.bottom = 0;
        panelWidget.left = 0;
        panelWidget.right = 0;
        panelWidget.alignMode = Widget.AlignMode.ALWAYS;

        // === 全屏黑色半透明遮罩 ===
        const mask = new Node("Mask");
        gameOverPanel.addChild(mask);
        const maskTransform = mask.addComponent(UITransform);
        maskTransform.setContentSize(750, 1334);
        const maskWidget = mask.addComponent(Widget);
        maskWidget.isAlignTop = true;
        maskWidget.isAlignBottom = true;
        maskWidget.isAlignLeft = true;
        maskWidget.isAlignRight = true;
        maskWidget.top = 0;
        maskWidget.bottom = 0;
        maskWidget.left = 0;
        maskWidget.right = 0;
        maskWidget.alignMode = Widget.AlignMode.ALWAYS;
        // 使用Graphics绘制遮罩
        const maskGraphics = mask.addComponent(Graphics);
        maskGraphics.fillColor = new Color(0, 0, 0, 200);  // 更深的遮罩
        maskGraphics.rect(-375, -667, 750, 1334);
        maskGraphics.fill();

        // === 中央横幅底板 ===
        const banner = new Node("Banner");
        gameOverPanel.addChild(banner);
        const bannerTransform = banner.addComponent(UITransform);
        bannerTransform.setContentSize(420, 180);
        banner.setPosition(v3(0, 50, 0));
        
        // 横幅背景（深色带金边，无红色横条）
        const bannerGraphics = banner.addComponent(Graphics);
        // 主背景
        bannerGraphics.fillColor = new Color(25, 22, 40, 250);
        bannerGraphics.roundRect(-210, -90, 420, 180, 12);
        bannerGraphics.fill();
        // 金色边框
        bannerGraphics.strokeColor = new Color(180, 150, 80, 255);
        bannerGraphics.lineWidth = 3;
        bannerGraphics.roundRect(-210, -90, 420, 180, 12);
        bannerGraphics.stroke();
        // 内部高亮边
        bannerGraphics.strokeColor = new Color(255, 220, 150, 50);
        bannerGraphics.lineWidth = 1;
        bannerGraphics.roundRect(-206, -86, 412, 172, 10);
        bannerGraphics.stroke();

        // === 挑战失败文本 ===
        const failText = new Node("FailText");
        banner.addChild(failText);
        failText.setPosition(v3(0, 40, 0));
        const failTextTransform = failText.addComponent(UITransform);
        failTextTransform.setContentSize(400, 60);
        const failLabel = failText.addComponent(Label);
        failLabel.string = "💀 挑战失败";
        failLabel.fontSize = 38;
        failLabel.color = new Color(255, 90, 90);
        failLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        failLabel.verticalAlign = Label.VerticalAlign.CENTER;
        failLabel.enableOutline = true;
        failLabel.outlineColor = new Color(60, 0, 0, 200);
        failLabel.outlineWidth = 2;

        // === 提示文本 ===
        const hintText = new Node("HintText");
        banner.addChild(hintText);
        hintText.setPosition(v3(0, -5, 0));
        const hintTransform = hintText.addComponent(UITransform);
        hintTransform.setContentSize(400, 30);
        const hintLabel = hintText.addComponent(Label);
        hintLabel.string = "基地已被摧毁";
        hintLabel.fontSize = 16;
        hintLabel.color = new Color(160, 160, 170);
        hintLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        hintLabel.verticalAlign = Label.VerticalAlign.CENTER;

        // === 重新挑战按钮 ===
        const resetButton = new Node("ResetButton");
        banner.addChild(resetButton);
        resetButton.setPosition(v3(0, -55, 0));
        const btnTransform = resetButton.addComponent(UITransform);
        btnTransform.setContentSize(160, 44);
        
        // 按钮背景
        const btnGraphics = resetButton.addComponent(Graphics);
        btnGraphics.fillColor = new Color(50, 120, 200, 255);
        btnGraphics.roundRect(-80, -22, 160, 44, 6);
        btnGraphics.fill();
        // 边框
        btnGraphics.strokeColor = new Color(80, 160, 255, 255);
        btnGraphics.lineWidth = 2;
        btnGraphics.roundRect(-80, -22, 160, 44, 6);
        btnGraphics.stroke();
        
        // 按钮文本
        const btnLabel = new Node("Label");
        resetButton.addChild(btnLabel);
        const btnLabelTransform = btnLabel.addComponent(UITransform);
        btnLabelTransform.setContentSize(160, 44);
        const label = btnLabel.addComponent(Label);
        label.string = "🔄 重新挑战";
        label.fontSize = 20;
        label.color = new Color(255, 255, 255);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.enableOutline = true;
        label.outlineColor = new Color(20, 50, 100, 200);
        label.outlineWidth = 1;

        // 添加按钮组件
        const button = resetButton.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 1.1;
        
        // 绑定点击事件 - 使用类型安全的方式查找UIController
        button.node.on(Button.EventType.CLICK, () => {
            // 方法1：通过类查找
            let uiController = this.canvas.getComponentInChildren(UIController);
            
            // 方法2：如果方法1失败，遍历查找
            if (!uiController) {
                const allNodes: Node[] = [];
                const collectNodes = (node: Node) => {
                    allNodes.push(node);
                    node.children.forEach(child => collectNodes(child));
                };
                collectNodes(this.canvas);
                for (const node of allNodes) {
                    const uc = node.getComponent(UIController);
                    if (uc) {
                        uiController = uc;
                        break;
                    }
                }
            }
            
            if (uiController) {
                uiController.onResetButtonClick();
                console.log("调用 onResetButtonClick 成功");
            } else {
                // 方法3：直接重新加载场景
                console.warn("UIController未找到，直接重新加载场景");
                TouchManager.money = GameConfig.INITIAL_MONEY;
                TouchManager.baseHealth = GameConfig.INITIAL_HEALTH;
                TouchManager.isGameOver = false;
                TouchManager.isVictory = false;
                TouchManager.totalDamage = 0;
                TouchManager.totalGoldEarned = 0;
                TouchManager.gameStartTime = 0;
                director.loadScene(director.getScene()!.name);
            }
        }, this);
    }

    /**
     * 创建胜利结算UI
     */
    private createVictoryUI() {
        const victoryPanel = new Node("VictoryPanel");
        this.canvas.addChild(victoryPanel);
        victoryPanel.active = false;
        // 确保胜利面板在最顶层
        victoryPanel.setSiblingIndex(99999);

        const panelTransform = victoryPanel.addComponent(UITransform);
        panelTransform.setContentSize(750, 1334);

        const panelWidget = victoryPanel.addComponent(Widget);
        panelWidget.isAlignTop = true;
        panelWidget.isAlignBottom = true;
        panelWidget.isAlignLeft = true;
        panelWidget.isAlignRight = true;
        panelWidget.top = 0;
        panelWidget.bottom = 0;
        panelWidget.left = 0;
        panelWidget.right = 0;
        panelWidget.alignMode = Widget.AlignMode.ALWAYS;

        // === 全屏黑色半透明遮罩 ===
        const mask = new Node("Mask");
        victoryPanel.addChild(mask);
        const maskTransform = mask.addComponent(UITransform);
        maskTransform.setContentSize(750, 1334);
        const maskWidget = mask.addComponent(Widget);
        maskWidget.isAlignTop = true;
        maskWidget.isAlignBottom = true;
        maskWidget.isAlignLeft = true;
        maskWidget.isAlignRight = true;
        maskWidget.top = 0;
        maskWidget.bottom = 0;
        maskWidget.left = 0;
        maskWidget.right = 0;
        maskWidget.alignMode = Widget.AlignMode.ALWAYS;
        const maskGraphics = mask.addComponent(Graphics);
        maskGraphics.fillColor = new Color(0, 0, 0, 200);
        maskGraphics.rect(-375, -667, 750, 1334);
        maskGraphics.fill();

        // === 中央横幅底板（更大以容纳更多信息）===
        const banner = new Node("Banner");
        victoryPanel.addChild(banner);
        const bannerTransform = banner.addComponent(UITransform);
        bannerTransform.setContentSize(450, 320);
        banner.setPosition(v3(0, 30, 0));
        
        // 横幅背景（深色带金边）
        const bannerGraphics = banner.addComponent(Graphics);
        // 主背景
        bannerGraphics.fillColor = new Color(20, 30, 45, 250);
        bannerGraphics.roundRect(-225, -160, 450, 320, 12);
        bannerGraphics.fill();
        // 金色边框
        bannerGraphics.strokeColor = new Color(255, 215, 0, 255);
        bannerGraphics.lineWidth = 3;
        bannerGraphics.roundRect(-225, -160, 450, 320, 12);
        bannerGraphics.stroke();
        // 内部高亮边
        bannerGraphics.strokeColor = new Color(255, 240, 180, 50);
        bannerGraphics.lineWidth = 1;
        bannerGraphics.roundRect(-221, -156, 442, 312, 10);
        bannerGraphics.stroke();

        // === 通关成功文本 ===
        const victoryText = new Node("VictoryText");
        banner.addChild(victoryText);
        victoryText.setPosition(v3(0, 115, 0));
        const victoryTextTransform = victoryText.addComponent(UITransform);
        victoryTextTransform.setContentSize(400, 60);
        const victoryLabel = victoryText.addComponent(Label);
        victoryLabel.string = "🏆 通关成功！";
        victoryLabel.fontSize = 38;
        victoryLabel.color = new Color(255, 215, 0);
        victoryLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        victoryLabel.verticalAlign = Label.VerticalAlign.CENTER;
        victoryLabel.enableOutline = true;
        victoryLabel.outlineColor = new Color(100, 70, 0, 200);
        victoryLabel.outlineWidth = 2;

        // === 统计信息区域 ===
        const statsArea = new Node("StatsArea");
        banner.addChild(statsArea);
        statsArea.setPosition(v3(0, 20, 0));

        // 通关用时
        const timeRow = this.createStatRow("TimeRow", "⏱️ 通关用时", "00:00", 0, 45);
        statsArea.addChild(timeRow);

        // 赚取金币
        const goldRow = this.createStatRow("GoldRow", "💰 赚取金币", "0", 0, 5);
        statsArea.addChild(goldRow);

        // 总伤害
        const damageRow = this.createStatRow("DamageRow", "⚔️ 总伤害", "0", 0, -35);
        statsArea.addChild(damageRow);

        // === 重新挑战按钮 ===
        const resetButton = new Node("ResetButton");
        banner.addChild(resetButton);
        resetButton.setPosition(v3(0, -115, 0));
        const btnTransform = resetButton.addComponent(UITransform);
        btnTransform.setContentSize(180, 50);
        
        // 按钮背景（金色调）
        const btnGraphics = resetButton.addComponent(Graphics);
        btnGraphics.fillColor = new Color(180, 140, 50, 255);
        btnGraphics.roundRect(-90, -25, 180, 50, 8);
        btnGraphics.fill();
        // 边框
        btnGraphics.strokeColor = new Color(255, 215, 0, 255);
        btnGraphics.lineWidth = 2;
        btnGraphics.roundRect(-90, -25, 180, 50, 8);
        btnGraphics.stroke();
        
        // 按钮文本
        const btnLabel = new Node("Label");
        resetButton.addChild(btnLabel);
        const btnLabelTransform = btnLabel.addComponent(UITransform);
        btnLabelTransform.setContentSize(180, 50);
        const label = btnLabel.addComponent(Label);
        label.string = "🔄 重新挑战";
        label.fontSize = 22;
        label.color = new Color(255, 255, 255);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.enableOutline = true;
        label.outlineColor = new Color(80, 60, 20, 200);
        label.outlineWidth = 1;

        // 添加按钮组件
        const button = resetButton.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 1.1;
        
        // 绑定点击事件
        button.node.on(Button.EventType.CLICK, () => {
            let uiController = this.canvas.getComponentInChildren(UIController);
            
            if (!uiController) {
                const allNodes: Node[] = [];
                const collectNodes = (node: Node) => {
                    allNodes.push(node);
                    node.children.forEach(child => collectNodes(child));
                };
                collectNodes(this.canvas);
                for (const node of allNodes) {
                    const uc = node.getComponent(UIController);
                    if (uc) {
                        uiController = uc;
                        break;
                    }
                }
            }
            
            if (uiController) {
                uiController.onResetButtonClick();
            } else {
                console.warn("UIController未找到，直接重新加载场景");
                TouchManager.money = GameConfig.INITIAL_MONEY;
                TouchManager.baseHealth = GameConfig.INITIAL_HEALTH;
                TouchManager.isGameOver = false;
                TouchManager.isVictory = false;
                TouchManager.totalDamage = 0;
                TouchManager.totalGoldEarned = 0;
                TouchManager.gameStartTime = 0;
                director.loadScene(director.getScene()!.name);
            }
        }, this);
    }

    /**
     * 创建统计行
     */
    private createStatRow(name: string, labelText: string, valueText: string, x: number, y: number): Node {
        const row = new Node(name);
        row.setPosition(v3(x, y, 0));
        
        // 标签
        const labelNode = new Node("Label");
        row.addChild(labelNode);
        labelNode.setPosition(v3(-80, 0, 0));
        const labelTransform = labelNode.addComponent(UITransform);
        labelTransform.setContentSize(150, 30);
        const label = labelNode.addComponent(Label);
        label.string = labelText;
        label.fontSize = 18;
        label.color = new Color(200, 200, 210);
        label.horizontalAlign = Label.HorizontalAlign.LEFT;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        
        // 数值
        const valueNode = new Node("Value");
        row.addChild(valueNode);
        valueNode.setPosition(v3(80, 0, 0));
        const valueTransform = valueNode.addComponent(UITransform);
        valueTransform.setContentSize(150, 30);
        const valueLabel = valueNode.addComponent(Label);
        valueLabel.string = valueText;
        valueLabel.fontSize = 20;
        valueLabel.color = new Color(255, 235, 150);
        valueLabel.horizontalAlign = Label.HorizontalAlign.RIGHT;
        valueLabel.verticalAlign = Label.VerticalAlign.CENTER;
        valueLabel.enableOutline = true;
        valueLabel.outlineColor = new Color(50, 40, 0, 150);
        valueLabel.outlineWidth = 1;
        
        return row;
    }

    /**
     * 创建风格化按钮（用于收起/展开）
     */
    private createStyledButton(name: string, text: string, width: number, height: number, fontSize: number): Node {
        const btn = new Node(name);
        const transform = btn.addComponent(UITransform);
        transform.setContentSize(width, height);
        
        const g = btn.addComponent(Graphics);
        // 背景
        g.fillColor = new Color(22, 26, 38, 255);
        g.roundRect(-width/2, -height/2, width, height, 6);
        g.fill();
        // 边框
        g.strokeColor = new Color(200, 170, 100, 255);
        g.lineWidth = 2;
        g.roundRect(-width/2, -height/2, width, height, 6);
        g.stroke();
        
        // 文本
        const labelNode = this.createLabel("Label", text, fontSize, Color.WHITE);
        btn.addChild(labelNode);
        
        btn.addComponent(Button);
        return btn;
    }

    /**
     * 创建标签
     */
    private createLabel(name: string, text: string, fontSize: number, color: Color): Node {
        const node = new Node(name);
        const transform = node.addComponent(UITransform);
        transform.setContentSize(200, 30);
        
        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.color = color;
        label.isBold = true;
        
        return node;
    }

    /**
     * 创建按钮
     */
    private createButton(name: string, text: string, fontSize: number, color: Color): Node {
        const node = new Node(name);
        const transform = node.addComponent(UITransform);
        transform.setContentSize(100, 40);
        
        // 按钮背景
        const sprite = node.addComponent(Sprite);
        sprite.color = color;
        
        // 按钮组件
        const button = node.addComponent(Button);
        button.transition = Button.Transition.COLOR;
        button.normalColor = color;
        button.hoverColor = new Color(
            Math.min(255, color.r + 30),
            Math.min(255, color.g + 30),
            Math.min(255, color.b + 30)
        );
        button.pressedColor = new Color(
            Math.max(0, color.r - 30),
            Math.max(0, color.g - 30),
            Math.max(0, color.b - 30)
        );

        // 按钮文本
        const labelNode = this.createLabel("Label", text, fontSize, Color.WHITE);
        node.addChild(labelNode);
        const labelWidget = labelNode.addComponent(Widget);
        labelWidget.isAlignTop = true;
        labelWidget.isAlignBottom = true;
        labelWidget.isAlignLeft = true;
        labelWidget.isAlignRight = true;
        
        return node;
    }
}
