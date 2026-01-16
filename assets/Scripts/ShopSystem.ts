import { _decorator, Component, Node, Label, Button, Sprite, Color, Prefab, instantiate, UITransform, Widget, v3, find, tween, Vec3, Graphics, resources, SpriteFrame, Texture2D } from 'cc';
import { TowerConfig, TowerData, TowerRarity } from './TowerType';
import { TouchManager } from './TouchManager';
import { WaveSystem } from './WaveSystem';
import { ShopCard } from './ShopCard';
import { DragDropSystem } from './DragDropSystem';

const { ccclass, property } = _decorator;

/**
 * 商店系统
 * 支持收起/展开、拖拽、每波自动刷新
 */
@ccclass('ShopSystem')
export class ShopSystem extends Component {
    @property(Node) public shopPanel: Node = null!;
    @property(Node) public cardContainer: Node = null!;
    @property(Prefab) public cardPrefab: Prefab | Node = null!;
    @property(Button) public refreshButton: Button = null!;
    @property(Button) public toggleButton: Button = null!;  // 收起/展开按钮
    @property(Label) public refreshCostLabel: Label = null!;
    
    private readonly FREE_REFRESH_COUNT = 2;  // 每波免费刷新次数
    private readonly CARD_COUNT = 4;    // 每次显示4张卡
    private freeRefreshLeft: number = 2;  // 剩余免费刷新次数
    private currentCards: { towerData: TowerData; node: Node }[] = [];
    private lastWave: number = 0;
    private waveSystem: WaveSystem | null = null;
    private isExpanded: boolean = true;  // 是否展开
    private expandedHeight: number = 195;  // 展开时的高度
    private collapsedHeight: number = 10;  // 收起后只露出一条细边
    private dragDropSystem: DragDropSystem | null = null;

    start() {
        console.log("=== ShopSystem.start() 开始 ===");
        
        // 查找WaveSystem和DragDropSystem
        const canvas = find("Canvas");
        
        // 检查是否有重复的 ShopPanel
        if (canvas) {
            const allShopPanels = canvas.children.filter(child => child.name === "ShopPanel");
            console.log(`⚠️ 发现 ${allShopPanels.length} 个 ShopPanel 节点！`);
            if (allShopPanels.length > 1) {
                console.error(`❌ 有多个 ShopPanel！这可能导致显示问题。`);
            }
            
            this.waveSystem = canvas.getComponentInChildren(WaveSystem);
            this.dragDropSystem = canvas.getComponent(DragDropSystem) || canvas.getComponentInChildren(DragDropSystem);
            
            // 如果DragDropSystem不存在，创建一个
            if (!this.dragDropSystem) {
                this.dragDropSystem = canvas.addComponent(DragDropSystem);
                // 尝试从TouchManager获取towerPrefab
                const touchManager = canvas.getComponentInChildren(TouchManager);
                if (touchManager && (touchManager as any).towerPrefab) {
                    (this.dragDropSystem as any).towerPrefab = (touchManager as any).towerPrefab;
                }
            }
        }
        
        // 强制清空旧的 cardPrefab，使用新的 createCardNode() 方法
        this.cardPrefab = null!;
        console.log("已清空 cardPrefab，将使用 createCardNode() 创建新卡片");
        
        // 不再从 cardContainer 中获取模板，强制使用 createCardNode()
        // 旧代码：if (!this.cardPrefab && this.cardContainer) { ... }
        console.log("ShopSystem: 跳过模板查找，强制使用 createCardNode()");
        
        // 绑定按钮
        if (this.refreshButton) {
            this.refreshButton.node.on(Button.EventType.CLICK, this.onRefreshClick, this);
        }
        
        if (this.toggleButton) {
            this.toggleButton.node.on(Button.EventType.CLICK, this.onToggleClick, this);
        }
        
        // 延迟初始化商店
        this.scheduleOnce(() => {
            // 只有当 cardContainer 被 UIBuilder 赋值后才刷新
            // 如果此时 cardContainer 仍为空，说明 UIBuilder 还没运行完，
            // 那么 UIBuilder 会在它自己的流程里调用 refreshShop，这里就不用管了
            if (this.cardContainer) {
                // 调试：打印商店面板和容器信息
                if (this.shopPanel) {
                    const panelTransform = this.shopPanel.getComponent(UITransform);
                    console.log(`🎪 ShopPanel 尺寸: ${panelTransform?.width}x${panelTransform?.height}`);
                    console.log(`🎪 ShopPanel 位置: (${this.shopPanel.position.x}, ${this.shopPanel.position.y})`);
                }
                const containerTransform = this.cardContainer.getComponent(UITransform);
                console.log(`📦 CardContainer 尺寸: ${containerTransform?.width}x${containerTransform?.height}`);
                console.log(`📦 CardContainer 位置: (${this.cardContainer.position.x}, ${this.cardContainer.position.y})`);
                console.log(`📦 CardContainer 子节点数: ${this.cardContainer.children.length}`);
                
                this.refreshShop();
                this.updateRefreshButton();
            } else {
                console.log("ShopSystem: 等待 UIBuilder 初始化 CardContainer...");
            }
        }, 0.2);
        
        // 延迟更长时间初始化按钮样式（确保 UIBuilder 创建完成）
        this.scheduleOnce(() => {
            this.updateToggleButtonStyle();
        }, 0.5);
    }
    
    /**
     * 更新收起/展开按钮样式（仅显示三角图标）
     */
    private updateToggleButtonStyle() {
        if (!this.toggleButton) return;
        
        const btnGraphics = this.toggleButton.node.getComponent(Graphics);
        if (btnGraphics) {
            const btnW = 80, btnH = 32;
            btnGraphics.clear();
            
            // 按钮背景（和面板同色）
            btnGraphics.fillColor = new Color(22, 26, 38, 255);
            btnGraphics.roundRect(-btnW/2, -btnH/2, btnW, btnH, 6);
            btnGraphics.fill();
            
            // 边框（金色，完整包围）
            btnGraphics.strokeColor = new Color(200, 170, 100, 255);
            btnGraphics.lineWidth = 2;
            btnGraphics.roundRect(-btnW/2, -btnH/2, btnW, btnH, 6);
            btnGraphics.stroke();
            
            // 绘制三角形图标
            const triangleSize = 10;
            btnGraphics.fillColor = new Color(255, 255, 255, 255);
            
            if (this.isExpanded) {
                // 展开状态：向下三角形 ▼（点击后收起）
                btnGraphics.moveTo(0, -triangleSize/2);
                btnGraphics.lineTo(-triangleSize, triangleSize/2);
                btnGraphics.lineTo(triangleSize, triangleSize/2);
                btnGraphics.lineTo(0, -triangleSize/2);  // 回到起点闭合
                btnGraphics.fill();
            } else {
                // 收起状态：向上三角形 ▲（点击后展开）
                btnGraphics.moveTo(0, triangleSize/2);
                btnGraphics.lineTo(-triangleSize, -triangleSize/2);
                btnGraphics.lineTo(triangleSize, -triangleSize/2);
                btnGraphics.lineTo(0, triangleSize/2);  // 回到起点闭合
                btnGraphics.fill();
            }
        }
        
        // 隐藏文字标签（只显示图标）
        const label = this.toggleButton.node.getChildByName("Label");
        if (label) {
            label.active = false;
        }
    }

    update() {
        // 确保商店面板始终在高层级（防止被怪物遮挡）
        // 使用固定的高层级值，而不是动态计算
        // 游戏结束时不更新商店层级（让结算界面在最上层）
        if (!TouchManager.isGameOver && this.shopPanel && this.shopPanel.parent) {
            // 商店面板固定在层级500，高于怪物（最高约110）但低于结算界面
            const SHOP_PANEL_INDEX = 500;
            if (this.shopPanel.getSiblingIndex() !== SHOP_PANEL_INDEX) {
                this.shopPanel.setSiblingIndex(SHOP_PANEL_INDEX);
            }
        }
        
        // 尝试获取 WaveSystem（如果还没有）
        if (!this.waveSystem) {
            const canvas = find("Canvas");
            if (canvas) {
                // 方法1: getComponentInChildren
                this.waveSystem = canvas.getComponentInChildren(WaveSystem);
                
                // 方法2: 遍历所有子节点
                if (!this.waveSystem) {
                    for (const child of canvas.children) {
                        const ws = child.getComponent(WaveSystem);
                        if (ws) {
                            this.waveSystem = ws;
                            console.log("🔍 找到 WaveSystem (方法2):", child.name);
                            break;
                        }
                    }
                }
                
                // 方法3: 直接在Canvas上查找
                if (!this.waveSystem) {
                    this.waveSystem = canvas.getComponent(WaveSystem);
                    if (this.waveSystem) {
                        console.log("🔍 找到 WaveSystem (方法3): Canvas本身");
                    }
                }
                
                if (this.waveSystem) {
                    console.log("✅ WaveSystem 已获取成功");
                }
            }
        }
        
        // 检查波次变化，只重置免费刷新次数，不刷新商店页面
        // 商店页面只在游戏初始化和重新挑战时刷新
        if (this.waveSystem) {
            const currentWave = this.waveSystem.getCurrentWave();
            
            // 新波次开始时（从第2波开始），只重置免费刷新次数，不刷新商店
            if (currentWave > this.lastWave && currentWave > 1) {
                console.log(`🔄 新波次开始: ${this.lastWave} -> ${currentWave}, 重置免费刷新次数`);
                this.lastWave = currentWave;
                // 只重置免费刷新次数，不刷新商店页面
                this.freeRefreshLeft = this.FREE_REFRESH_COUNT;
                console.log(`🔄 免费刷新次数已重置为: ${this.freeRefreshLeft}`);
            } else if (currentWave > this.lastWave && currentWave === 1) {
                // 第1波开始时，只更新lastWave，不重置刷新次数（与备战阶段共用）
                console.log(`🔄 第1波开始，与备战阶段共用刷新次数`);
                this.lastWave = currentWave;
            }
            
            // 备战阶段重置（重新挑战时）
            if (currentWave === 0 && this.lastWave > 0) {
                console.log(`🔄 回到备战阶段，重置状态`);
                this.lastWave = 0;
                this.freeRefreshLeft = this.FREE_REFRESH_COUNT;
            }
        }
        
        this.updateRefreshButton();
    }

    /**
     * 完全重置商店（重新挑战时调用）
     */
    public resetShop() {
        console.log("完全重置商店...");
        
        // 重置免费刷新次数
        this.freeRefreshLeft = this.FREE_REFRESH_COUNT;
        this.lastWave = 0;
        
        // 先清理所有旧卡片
        this.clearCards();
        
        // 刷新商店卡片（生成新卡片）
        this.refreshShop();
        
        // 确保商店是展开状态
        if (!this.isExpanded) {
            this.expandShop();
        }
        
        // 延迟加载所有卡片的贴图（确保节点已创建）
        this.scheduleOnce(() => {
            this.currentCards.forEach(card => {
                const shopCard = card.node.getComponent(ShopCard);
                if (shopCard) {
                    shopCard.loadTowerIcon();
                }
            });
            console.log("商店卡片贴图已加载");
        }, 0.05);
        
        console.log("商店已完全重置");
    }
    
    /**
     * 刷新商店
     */
    refreshShop() {
        console.log("刷新商店...");
        
        if (!this.cardContainer) {
            console.error("CardContainer未设置！");
            return;
        }
        
        // 清理旧卡片
        this.clearCards();
        
        // 生成新卡片
        const availableTowers = [...TowerConfig.TOWERS];
        for (let i = 0; i < this.CARD_COUNT; i++) {
            if (availableTowers.length === 0) break;
            
            const selectedTower = this.selectRandomTower(availableTowers);
            if (selectedTower) {
                this.createCard(selectedTower);
            }
        }
        
        console.log(`商店刷新完成，生成了 ${this.currentCards.length} 张卡片`);
        
        // 居中排列卡片
        this.layoutCards();
        this.updateRefreshButton();
    }
    
    /**
     * 居中排列卡片
     */
    private layoutCards() {
        const CARD_WIDTH = 100;
        const CARD_GAP = 25;  // 增加卡片间距
        const cardCount = this.currentCards.length;
        if (cardCount === 0) return;
        
        const totalWidth = cardCount * CARD_WIDTH + (cardCount - 1) * CARD_GAP;
        const startX = -totalWidth / 2 + CARD_WIDTH / 2;
        
        this.currentCards.forEach((card, index) => {
            const x = startX + index * (CARD_WIDTH + CARD_GAP);
            card.node.setPosition(v3(x, 0, 0));
        });
    }

    /**
     * 带权重随机选择防御塔
     */
    private selectRandomTower(towers: TowerData[]): TowerData {
        if (towers.length === 0) return null!;
        
        const weights: number[] = towers.map(t => {
            switch (t.rarity) {
                case TowerRarity.WHITE: return 3;
                case TowerRarity.GREEN: return 2;
                case TowerRarity.BLUE: return 1;
                default: return 1;
            }
        });
        
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        let random = Math.random() * totalWeight;
        
        for (let i = 0; i < towers.length; i++) {
            random -= weights[i];
            if (random <= 0) {
                return towers[i];
            }
        }
        
        return towers[0];
    }

    /**
     * 创建商店卡片
     */
    private createCard(towerData: TowerData) {
        if (!this.cardContainer) return;
        
        console.log("=== ShopSystem.createCard: 创建卡片 ===");
        const cardNode = this.createCardNode();
        
        if (!cardNode) {
            console.error("createCardNode() 返回null");
            return;
        }
        
        cardNode.active = true;
        this.cardContainer.addChild(cardNode);
        
        // 设置卡片数据
        const shopCard = cardNode.getComponent(ShopCard) || cardNode.addComponent(ShopCard);
        shopCard.setTowerData(towerData);
        
        // 存储towerData到节点，供拖拽系统使用
        (cardNode as any).towerData = towerData;
        
        // 绑定拖拽事件（整个卡片可拖拽，不依赖BuyButton）
        // 旧的BuyButton已移除，不再查找
        // const buyButton = cardNode.getChildByName("BuyButton")?.getComponent(Button);
        
        // 支持直接点击卡片开始拖拽
        cardNode.on(Node.EventType.TOUCH_START, (event: any) => {
            // 如果已购买，不允许拖拽
            if ((shopCard as any).isPurchased) {
                return;
            }
            if (this.dragDropSystem && towerData) {
                console.log(`触摸卡片开始拖拽: ${towerData.name}`);
                this.dragDropSystem.startDrag(cardNode, towerData);
            }
        }, this);
        
        // 存储shopCard引用，方便后续操作
        (cardNode as any).shopCard = shopCard;
        
        this.currentCards.push({
            towerData: towerData,
            node: cardNode
        });
    }

    /**
     * 创建卡片节点（参考图2布局：名称描述在顶部，贴图居中，价格在底部）
     */
    private createCardNode(): Node {
        const CARD_WIDTH = 100;
        const CARD_HEIGHT = 155;
        
        const card = new Node("ShopCard");
        const cardTransform = card.addComponent(UITransform);
        cardTransform.setContentSize(CARD_WIDTH, CARD_HEIGHT);

        // 卡片边框（品质色，由 ShopCard.updateUI 设置颜色）
        const cardBorder = new Node("CardBorder");
        card.addChild(cardBorder);
        const borderTransform = cardBorder.addComponent(UITransform);
        borderTransform.setContentSize(CARD_WIDTH, CARD_HEIGHT);
        const borderGraphics = cardBorder.addComponent(Graphics);
        // 默认边框色，后续由 ShopCard.updateUI 根据品质更新
        borderGraphics.strokeColor = new Color(150, 150, 150, 255);
        borderGraphics.lineWidth = 2.5;
        borderGraphics.roundRect(-CARD_WIDTH/2, -CARD_HEIGHT/2, CARD_WIDTH, CARD_HEIGHT, 6);
        borderGraphics.stroke();

        // 贴图底板（浅色背景，占据大部分空间）
        const iconBg = new Node("IconBackground");
        card.addChild(iconBg);
        const iconBgTransform = iconBg.addComponent(UITransform);
        iconBgTransform.setContentSize(CARD_WIDTH - 6, CARD_HEIGHT - 32);
        iconBg.setPosition(v3(0, 5, 0));
        const iconBgGraphics = iconBg.addComponent(Graphics);
        iconBgGraphics.fillColor = new Color(55, 65, 85, 255);
        iconBgGraphics.roundRect(-(CARD_WIDTH-6)/2, -(CARD_HEIGHT-32)/2, CARD_WIDTH-6, CARD_HEIGHT-32, 4);
        iconBgGraphics.fill();

        // 防御塔贴图（居中偏下）
        const towerIcon = new Node("TowerIcon");
        card.addChild(towerIcon);
        const iconTransform = towerIcon.addComponent(UITransform);
        iconTransform.setContentSize(85, 85);
        iconTransform.anchorX = 0.5;
        iconTransform.anchorY = 0.5;
        towerIcon.setPosition(v3(0, -5, 0));
        const iconSprite = towerIcon.addComponent(Sprite);
        iconSprite.sizeMode = Sprite.SizeMode.CUSTOM;

        // 顶部名称描述底板（缩小宽度，避免遮挡边框）
        const topTextBg = new Node("TopTextBackground");
        card.addChild(topTextBg);
        const topTextBgTransform = topTextBg.addComponent(UITransform);
        const TEXT_BG_WIDTH = CARD_WIDTH - 6;  // 留出边框空间
        topTextBgTransform.setContentSize(TEXT_BG_WIDTH, 36);
        topTextBg.setPosition(v3(0, CARD_HEIGHT/2 - 21, 0));
        const topTextBgGraphics = topTextBg.addComponent(Graphics);
        topTextBgGraphics.fillColor = new Color(40, 45, 55, 240);
        topTextBgGraphics.roundRect(-TEXT_BG_WIDTH/2, -18, TEXT_BG_WIDTH, 36, 3);
        topTextBgGraphics.fill();

        // 名称标签（顶部）
        const nameLabel = this.createLabelNode("NameLabel", "防御塔", 14);
        card.addChild(nameLabel);
        nameLabel.setPosition(v3(0, CARD_HEIGHT/2 - 12, 0));
        const nameLabelComp = nameLabel.getComponent(Label)!;
        nameLabelComp.horizontalAlign = Label.HorizontalAlign.CENTER;
        nameLabelComp.enableOutline = true;
        nameLabelComp.outlineColor = new Color(0, 0, 0, 255);
        nameLabelComp.outlineWidth = 2;

        // 描述标签（名称下方）
        const descLabel = this.createLabelNode("DescLabel", "描述", 10);
        card.addChild(descLabel);
        descLabel.setPosition(v3(0, CARD_HEIGHT/2 - 28, 0));
        const descLabelComp = descLabel.getComponent(Label)!;
        descLabelComp.horizontalAlign = Label.HorizontalAlign.CENTER;
        descLabelComp.enableOutline = true;
        descLabelComp.outlineColor = new Color(0, 0, 0, 200);
        descLabelComp.outlineWidth = 1.5;
        const descTransform = descLabel.getComponent(UITransform)!;
        descTransform.setContentSize(CARD_WIDTH - 8, 14);
        descLabelComp.overflow = Label.Overflow.CLAMP;

        // 底部价格区域背景（缩小宽度，避免遮挡边框）
        const priceBg = new Node("PriceBackground");
        card.addChild(priceBg);
        const priceBgTransform = priceBg.addComponent(UITransform);
        const PRICE_BG_WIDTH = CARD_WIDTH - 6;  // 留出边框空间
        priceBgTransform.setContentSize(PRICE_BG_WIDTH, 22);
        priceBg.setPosition(v3(0, -CARD_HEIGHT/2 + 14, 0));
        const priceBgGraphics = priceBg.addComponent(Graphics);
        priceBgGraphics.fillColor = new Color(40, 45, 55, 240);
        priceBgGraphics.roundRect(-PRICE_BG_WIDTH/2, -11, PRICE_BG_WIDTH, 22, 3);
        priceBgGraphics.fill();

        // 价格区域
        const priceArea = new Node("PriceArea");
        card.addChild(priceArea);
        priceArea.addComponent(UITransform).setContentSize(60, 22);
        priceArea.setPosition(v3(0, -CARD_HEIGHT/2 + 12, 0));

        // 金币图标
        const coinIcon = this.createLabelNode("CoinIcon", "💰", 13);
        priceArea.addChild(coinIcon);
        coinIcon.setPosition(v3(-16, 0, 0));

        // 价格数字
        const costLabel = this.createLabelNode("CostLabel", "30", 16);
        priceArea.addChild(costLabel);
        costLabel.setPosition(v3(12, 0, 0));
        const costLabelComp = costLabel.getComponent(Label)!;
        costLabelComp.color = new Color(255, 220, 100, 255);
        costLabelComp.enableOutline = true;
        costLabelComp.outlineColor = new Color(80, 60, 0, 255);
        costLabelComp.outlineWidth = 2;

        // 已购买遮罩（默认隐藏）
        const purchasedMask = new Node("PurchasedMask");
        card.addChild(purchasedMask);
        purchasedMask.active = false;
        const maskTransform = purchasedMask.addComponent(UITransform);
        maskTransform.setContentSize(CARD_WIDTH, CARD_HEIGHT);
        const maskGraphics = purchasedMask.addComponent(Graphics);
        maskGraphics.fillColor = new Color(0, 0, 0, 180);
        maskGraphics.roundRect(-CARD_WIDTH/2, -CARD_HEIGHT/2, CARD_WIDTH, CARD_HEIGHT, 6);
        maskGraphics.fill();
        
        // 已购买文字
        const purchasedLabel = this.createLabelNode("PurchasedLabel", "已购买", 14);
        purchasedMask.addChild(purchasedLabel);
        purchasedLabel.setPosition(v3(0, 0, 0));
        const purchasedLabelComp = purchasedLabel.getComponent(Label)!;
        purchasedLabelComp.color = new Color(200, 200, 200);
        purchasedLabelComp.enableOutline = true;
        purchasedLabelComp.outlineColor = new Color(0, 0, 0, 200);
        purchasedLabelComp.outlineWidth = 1.5;

        return card;
    }

    /**
     * 创建标签节点
     */
    private createLabelNode(name: string, text: string, fontSize: number): Node {
        const node = new Node(name);
        const transform = node.addComponent(UITransform);
        transform.setContentSize(130, 25);
        
        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.color = Color.WHITE;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        
        return node;
    }

    /**
     * 刷新按钮点击
     */
    private onRefreshClick() {
        // 游戏结束时禁用交互
        if (TouchManager.isGameOver) return;
        
        if (this.freeRefreshLeft > 0) {
            this.freeRefreshLeft--;
            this.refreshShop();
        }
    }

    /**
     * 收起/展开按钮点击
     */
    private onToggleClick() {
        // 游戏结束时禁用交互
        if (TouchManager.isGameOver) return;
        
        if (this.isExpanded) {
            this.collapseShop();
        } else {
            this.expandShop();
        }
    }

    /**
     * 展开商店
     */
    private expandShop() {
        if (!this.shopPanel) return;
        
        this.isExpanded = true;
        const PANEL_W = 750;
        const PANEL_H = this.expandedHeight;
        
        // 恢复背景到完整尺寸
        const bg = this.shopPanel.getChildByName("PanelBackground");
        if (bg) {
            bg.active = true;
            const bgTransform = bg.getComponent(UITransform);
            if (bgTransform) bgTransform.setContentSize(PANEL_W, PANEL_H);
            const graphics = bg.getComponent(Graphics);
            if (graphics) {
                graphics.clear();
                // 主背景
                graphics.fillColor = new Color(22, 26, 38, 255);
                graphics.rect(-PANEL_W/2, -PANEL_H/2, PANEL_W, PANEL_H);
                graphics.fill();
                // 顶部金色边线（更亮更粗）
                graphics.strokeColor = new Color(200, 170, 100, 255);
                graphics.lineWidth = 3;
                graphics.moveTo(-PANEL_W/2, PANEL_H/2);
                graphics.lineTo(PANEL_W/2, PANEL_H/2);
                graphics.stroke();
                // 顶部内侧高光
                graphics.strokeColor = new Color(100, 90, 60, 150);
                graphics.lineWidth = 1;
                graphics.moveTo(-PANEL_W/2, PANEL_H/2 - 4);
                graphics.lineTo(PANEL_W/2, PANEL_H/2 - 4);
                graphics.stroke();
                // 底部细线
                graphics.strokeColor = new Color(50, 60, 80, 200);
                graphics.lineWidth = 1;
                graphics.moveTo(-PANEL_W/2, -PANEL_H/2 + 1);
                graphics.lineTo(PANEL_W/2, -PANEL_H/2 + 1);
                graphics.stroke();
            }
            bg.setPosition(v3(0, 0, 0));
        }
        
        // 设置面板高度
        const widget = this.shopPanel.getComponent(Widget);
        const transform = this.shopPanel.getComponent(UITransform);
        if (widget && transform) {
            widget.enabled = false;
            transform.setContentSize(PANEL_W, PANEL_H);
            this.shopPanel.setPosition(v3(this.shopPanel.position.x, PANEL_H / 2, 0));
            widget.bottom = 0;
            widget.enabled = true;
        }
        
        // 显示所有内容
        if (this.cardContainer) {
            this.cardContainer.active = true;
            // 重新触发卡片贴图加载
            this.currentCards.forEach(card => {
                const shopCard = card.node.getComponent(ShopCard);
                if (shopCard) {
                    shopCard.loadTowerIcon();
                }
            });
        }
        if (this.refreshButton) this.refreshButton.node.active = true;
        const titleBar = this.shopPanel.getChildByName("TitleBar");
        if (titleBar) titleBar.active = true;
        const leftArea = this.shopPanel.getChildByName("LeftArea");
        if (leftArea) leftArea.active = true;
        
        // 按钮位置和样式
        if (this.toggleButton) {
            this.toggleButton.node.setPosition(v3(
                this.toggleButton.node.position.x,
                PANEL_H / 2 + 18,
                0
            ));
            this.updateToggleButtonStyle();
        }
    }

    /**
     * 收起商店
     */
    private collapseShop() {
        if (!this.shopPanel) return;
        
        this.isExpanded = false;
        const COLLAPSED_H = 14;  // 收起后的细边高度（稍微增加）
        const PANEL_W = 750;
        
        // 隐藏内容
        if (this.cardContainer) this.cardContainer.active = false;
        if (this.refreshButton) this.refreshButton.node.active = false;
        const titleBar = this.shopPanel.getChildByName("TitleBar");
        if (titleBar) titleBar.active = false;
        const leftArea = this.shopPanel.getChildByName("LeftArea");
        if (leftArea) leftArea.active = false;
        
        // 重绘背景为细边
        const bg = this.shopPanel.getChildByName("PanelBackground");
        if (bg) {
            bg.active = true;
            const bgTransform = bg.getComponent(UITransform);
            if (bgTransform) bgTransform.setContentSize(PANEL_W, COLLAPSED_H);
            const graphics = bg.getComponent(Graphics);
            if (graphics) {
                graphics.clear();
                // 底板
                graphics.fillColor = new Color(22, 26, 38, 255);
                graphics.rect(-PANEL_W/2, -COLLAPSED_H/2, PANEL_W, COLLAPSED_H);
                graphics.fill();
                // 顶部金色边缘线（和展开时一样粗）
                graphics.strokeColor = new Color(200, 170, 100, 255);
                graphics.lineWidth = 3;
                graphics.moveTo(-PANEL_W/2, COLLAPSED_H/2);
                graphics.lineTo(PANEL_W/2, COLLAPSED_H/2);
                graphics.stroke();
            }
            bg.setPosition(v3(0, 0, 0));
        }
        
        // 设置面板高度
        const widget = this.shopPanel.getComponent(Widget);
        const transform = this.shopPanel.getComponent(UITransform);
        if (widget && transform) {
            widget.enabled = false;
            transform.setContentSize(PANEL_W, COLLAPSED_H);
            this.shopPanel.setPosition(v3(this.shopPanel.position.x, COLLAPSED_H / 2, 0));
            widget.bottom = 0;
            widget.enabled = true;
        }
        
        // 按钮位置和样式
        if (this.toggleButton) {
            this.toggleButton.node.setPosition(v3(
                this.toggleButton.node.position.x,
                COLLAPSED_H / 2 + 22,
                0
            ));
            this.updateToggleButtonStyle();
        }
    }

    /**
     * 更新刷新按钮状态
     */
    private updateRefreshButton() {
        if (!this.refreshButton) return;
        
        const text = `剩余 ${this.freeRefreshLeft} 次`;
        
        // 查找费用标签（新结构：CostLabel 子节点）
        const costLabelNode = this.refreshButton.node.getChildByName("CostLabel");
        if (costLabelNode) {
            const costLabel = costLabelNode.getComponent(Label);
            if (costLabel) {
                costLabel.string = text;
            }
        }
        
        // 备用：查找 Label 子节点
        const labelNode = this.refreshButton.node.getChildByName("Label");
        if (labelNode) {
            const label = labelNode.getComponent(Label);
            if (label && label.string.includes("剩余")) {
                label.string = text;
            }
        }
        
        // 旧结构兼容：refreshCostLabel
        if (this.refreshCostLabel) {
            this.refreshCostLabel.string = text;
        }
        
        // 更新按钮可交互状态（有免费次数时可用）
        this.refreshButton.interactable = this.freeRefreshLeft > 0;
    }

    /**
     * 清理所有卡片
     */
    private clearCards() {
        // 清除 currentCards 数组中的卡片
        this.currentCards.forEach(card => {
            if (card.node && card.node.isValid) {
                card.node.destroy();
            }
        });
        this.currentCards = [];
        
        // 🔥 额外清除 cardContainer 中的所有子节点（包括旧模板）
        if (this.cardContainer) {
            const allChildren = this.cardContainer.children.slice();  // 复制数组避免修改时出错
            allChildren.forEach(child => {
                console.log(`🧹 清除 CardContainer 中的旧节点: ${child.name}`);
                child.destroy();
            });
            if (allChildren.length > 0) {
                console.log(`✅ 已清除 ${allChildren.length} 个旧节点（包括模板）`);
            }
        }
    }
    
    /**
     * 标记卡片为已购买
     */
    public markCardAsPurchased(cardNode: Node) {
        console.log(`标记卡片为已购买: ${cardNode.name}`);
        
        // 获取 ShopCard 组件并标记为已购买（显示遮罩）
        const shopCard = cardNode.getComponent(ShopCard);
        if (shopCard) {
            shopCard.markAsPurchased();
            console.log(`卡片已标记为已购买，显示遮罩`);
        } else {
            // 如果没有 ShopCard 组件，直接显示遮罩
            const purchasedMask = cardNode.getChildByName("PurchasedMask");
            if (purchasedMask) {
                purchasedMask.active = true;
                console.log(`直接显示已购买遮罩`);
            }
        }
        
        // 不再从数组移除或销毁卡片，保留显示"已购买"状态
    }
    
    /**
     * 更新卡片布局（当卡片被移除后重新排列）
     */
    private updateCardLayout() {
        if (!this.cardContainer) return;
        
        this.currentCards.forEach((card, index) => {
            const cardNode = card.node;
            if (cardNode && cardNode.isValid) {
                const cardWidget = cardNode.getComponent(Widget);
                if (cardWidget) {
                    cardWidget.left = index * 150 + 10;
                }
            }
        });
    }
}
