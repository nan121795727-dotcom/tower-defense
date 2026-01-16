import { _decorator, Component, Node, Label, Button, Sprite, Color, Widget, UITransform, find, Graphics, resources, SpriteFrame, Texture2D } from 'cc';
import { TowerData, TowerConfig, TowerRarity } from './TowerType';
import { TouchManager } from './TouchManager';

const { ccclass, property } = _decorator;

const DEFAULT_TEXTURE = "tower";  // 默认贴图

/**
 * 商店卡片组件
 * 用于单个商店卡片的显示和交互
 */
@ccclass('ShopCard')
export class ShopCard extends Component {
    @property(Label) public nameLabel: Label = null!;
    @property(Label) public costLabel: Label = null!;
    @property(Label) public descLabel: Label = null!;
    @property(Button) public buyButton: Button = null!;
    // 背景现在使用 Graphics 组件，不再需要 bgSprite

    private towerData: TowerData | null = null;
    private isPurchased: boolean = false;  // 是否已购买
    private lastMoneyCheck: number = -1;  // 上次检查的金币数

    start() {
        // 如果属性未设置，尝试从子节点查找
        this.findChildComponents();
    }
    
    update() {
        // 实时检测金币变化，更新价格颜色
        if (this.towerData && this.costLabel && !this.isPurchased) {
            const currentMoney = TouchManager.money;
            if (currentMoney !== this.lastMoneyCheck) {
                this.lastMoneyCheck = currentMoney;
                this.updatePriceColor();
            }
        }
    }
    
    /**
     * 更新价格颜色（金币不足时显示红色）
     */
    private updatePriceColor() {
        if (!this.towerData || !this.costLabel) return;
        
        if (TouchManager.money < this.towerData.baseCost) {
            // 金币不足，显示红色
            this.costLabel.color = new Color(255, 80, 80, 255);
        } else {
            // 金币充足，显示正常颜色（金色）
            this.costLabel.color = new Color(255, 200, 100, 255);
        }
    }

    /**
     * 查找子节点组件
     */
    private findChildComponents() {
        if (!this.nameLabel) {
            const nameNode = this.node.getChildByName("NameLabel");
            if (nameNode) {
                this.nameLabel = nameNode.getComponent(Label);
            }
        }
        
        if (!this.costLabel) {
            // 新位置：在PriceArea下
            const priceArea = this.node.getChildByName("PriceArea");
            if (priceArea) {
                const costNode = priceArea.getChildByName("CostLabel");
                if (costNode) {
                    this.costLabel = costNode.getComponent(Label);
                }
            }
        }
        
        if (!this.descLabel) {
            const descNode = this.node.getChildByName("DescLabel");
            if (descNode) {
                this.descLabel = descNode.getComponent(Label);
            }
        }
        
        // 背景使用 Graphics，无需查找
    }

    /**
     * 设置防御塔数据
     */
    public setTowerData(towerData: TowerData) {
        this.towerData = towerData;
        // 确保组件已找到
        this.findChildComponents();
        this.updateUI();
    }

    /**
     * 更新UI显示
     */
    private updateUI() {
        if (!this.towerData) {
            console.warn("ShopCard: towerData is null");
            return;
        }

        const rarityColor = TowerConfig.getRarityColor(this.towerData.rarity);

        // 更新卡片边框颜色（品质色）
        const cardBorder = this.node.getChildByName("CardBorder");
        if (cardBorder) {
            const borderGraphics = cardBorder.getComponent(Graphics);
            if (borderGraphics) {
                borderGraphics.clear();
                borderGraphics.strokeColor = rarityColor;
                borderGraphics.lineWidth = 2.5;
                const transform = this.node.getComponent(UITransform);
                if (transform) {
                    const w = transform.width;
                    const h = transform.height;
                    borderGraphics.roundRect(-w/2, -h/2, w, h, 6);
                    borderGraphics.stroke();
                }
            }
        }

        // 更新名称（带品质颜色）
        if (this.nameLabel) {
            this.nameLabel.string = this.towerData.name;
            this.nameLabel.color = rarityColor;
        }

        // 更新价格
        if (this.costLabel) {
            this.costLabel.string = `${this.towerData.baseCost}`;
        }

        // 更新描述（带品质颜色，略淡）
        if (this.descLabel) {
            this.descLabel.string = this.towerData.description;
            // 描述使用略淡的品质色
            this.descLabel.color = new Color(
                Math.floor(rarityColor.r * 0.7 + 70),
                Math.floor(rarityColor.g * 0.7 + 70),
                Math.floor(rarityColor.b * 0.7 + 70),
                255
            );
        }
        
        // 加载并显示防御塔贴图
        this.loadTowerIcon();
    }
    
    /**
     * 加载防御塔贴图
     */
    public loadTowerIcon() {
        if (!this.towerData) return;
        
        const towerIcon = this.node.getChildByName("TowerIcon");
        if (!towerIcon) return;
        
        const iconSprite = towerIcon.getComponent(Sprite);
        if (!iconSprite) return;
        
        const textureName = this.towerData.spriteTexture || DEFAULT_TEXTURE;
        
        resources.load(`Textures/${textureName}/spriteFrame`, SpriteFrame, (err, spriteFrame) => {
            if (err) {
                // 尝试直接加载纹理
                resources.load(`Textures/${textureName}`, Texture2D, (err2, texture) => {
                    if (err2) {
                        // 加载失败，尝试默认贴图
                        if (textureName !== DEFAULT_TEXTURE) {
                            this.loadDefaultIcon(iconSprite);
                        }
                        return;
                    }
                    if (iconSprite && iconSprite.isValid) {
                        const newFrame = new SpriteFrame();
                        newFrame.texture = texture;
                        iconSprite.spriteFrame = newFrame;
                    }
                });
                return;
            }
            if (iconSprite && iconSprite.isValid) {
                iconSprite.spriteFrame = spriteFrame;
            }
        });
    }
    
    /**
     * 加载默认贴图
     */
    private loadDefaultIcon(iconSprite: Sprite) {
        resources.load(`Textures/${DEFAULT_TEXTURE}/spriteFrame`, SpriteFrame, (err, spriteFrame) => {
            if (err) {
                resources.load(`Textures/${DEFAULT_TEXTURE}`, Texture2D, (err2, texture) => {
                    if (err2) return;
                    if (iconSprite && iconSprite.isValid) {
                        const newFrame = new SpriteFrame();
                        newFrame.texture = texture;
                        iconSprite.spriteFrame = newFrame;
                    }
                });
                return;
            }
            if (iconSprite && iconSprite.isValid) {
                iconSprite.spriteFrame = spriteFrame;
            }
        });
    }

    /**
     * 标记为已购买
     */
    public markAsPurchased() {
        console.log(`ShopCard.markAsPurchased() 被调用，节点: ${this.node.name}`);
        this.isPurchased = true;
        
        // 显示已购买遮罩
        const purchasedMask = this.node.getChildByName("PurchasedMask");
        if (purchasedMask) {
            purchasedMask.active = true;
        }
        
        console.log(`ShopCard 已标记为已购买，isPurchased: ${this.isPurchased}`);
    }
    
    /**
     * 重置购买状态（商店刷新时调用）
     */
    public resetPurchaseState() {
        this.isPurchased = false;
        
        // 隐藏已购买遮罩
        const purchasedMask = this.node.getChildByName("PurchasedMask");
        if (purchasedMask) {
            purchasedMask.active = false;
        }
    }

    /**
     * 购买按钮点击（用于拖拽开始）
     */
    public onBuyClick() {
        if (!this.towerData) return;

        if (TouchManager.money >= this.towerData.baseCost) {
            TouchManager.money -= this.towerData.baseCost;
            TouchManager.pendingTowerData = this.towerData;
            
            console.log(`购买了 ${this.towerData.name}，请拖拽到地图放置`);
            
            // 通知ShopSystem移除/更新该卡片
            const canvas = find("Canvas");
            const shopSystem = canvas?.getComponent("ShopSystem") as any;
            if (shopSystem && typeof shopSystem.markCardAsPurchased === "function") {
                shopSystem.markCardAsPurchased(this.node);
            } else {
                // 如果找不到ShopSystem，至少本地标记为已购买
                this.markAsPurchased();
            }
        }
    }
}
