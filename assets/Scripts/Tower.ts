import { _decorator, Component, Node, Vec3, find, Label, v3, Prefab, instantiate, Sprite, Color, UITransform, Graphics, resources, SpriteFrame, Texture2D } from 'cc';
import { Bullet } from './Bullet';
import { GameConfig } from './GameConfig';
import { TowerData, TowerConfig, TowerRarity, SkillType } from './TowerType';
import { Enemy } from './Enemy';
import { TouchManager } from './TouchManager';

const { ccclass, property } = _decorator;

@ccclass('Tower')
export class Tower extends Component {
    @property(Prefab) public bulletPrefab: Prefab = null!; 
    @property(Label) public levelLabel: Label = null!;
    @property(Sprite) public towerSprite: Sprite = null!;  // 用于显示品质颜色

    public towerData: TowerData | null = null;  // 防御塔数据
    public towerId: string = "";  // 防御塔ID
    public level: number = 1;
    public currentExp: number = 0;  // 当前等级已吸收的 LV1 数量
    public readonly MAX_LEVEL = 4;  // 最大等级
    private isPreviewMode: boolean = false;  // 是否为预览模式（不显示顶部信息）
    
    // 获取当前等级升级需要的 LV1 数量
    public get nextLevelNeeded(): number {
        if (this.level >= this.MAX_LEVEL) return 0;
        const mergeCosts = GameConfig.TOWER_MERGE_COST;
        return mergeCosts[this.level - 1] || 2;
    }

    private attackTimer: number = 0;
    private skillTimer: number = 0;
    private range: number = 250;
    private damage: number = 5;  // 整数伤害
    private attackInterval: number = 1.2;
    private canvas: Node | null = null;
    private damageBuff: number = 0;  // 伤害buff
    private speedBuff: number = 0;  // 速度buff
    private buffTimer: number = 0;  // buff剩余时间
    private labelBackground: Node | null = null;  // 标签背景

    /**
     * 设置预览模式（不显示顶部信息）
     */
    public setPreviewMode(isPreview: boolean) {
        this.isPreviewMode = isPreview;
    }
    
    /**
     * 初始化防御塔
     */
    public init(towerData: TowerData) {
        this.towerData = towerData;
        this.towerId = towerData.id;
        this.level = 1;
        this.currentExp = 0;  // 当前等级已吸收的 LV1 数量
        
        // 应用基础属性
        this.range = towerData.baseRange;
        this.damage = Math.floor(towerData.baseDamage);  // 确保整数
        this.attackInterval = towerData.baseAttackInterval;
        
        // 确保锚点居中
        this.ensureSpriteAnchor();
        
        // 更新UI和外观
        this.updateUI();
        this.updateAppearance();
    }

    start() {
        this.canvas = find("Canvas");
        if (!this.towerData && this.towerId) {
            // 如果只有ID，尝试加载数据
            const data = TowerConfig.getTowerData(this.towerId);
            if (data) {
                this.init(data);
            }
        }
        
        // 确保锚点居中
        this.ensureSpriteAnchor();
        this.updateUI();
        
        // 不再创建标签背景（已移除黑色底板）
        // this.createLabelBackground();
        
        // 添加精灵描边效果
        this.addSpriteOutline();
        
        // 根据Y坐标动态调整层级
        this.updateZIndexByPosition();
    }

    /**
     * 吸收 LV1 塔进行升级（新逻辑：所有等级都只接受 LV1 的同名塔）
     */
    public absorb(otherTower: Tower): boolean {
        // 检查是否达到最大等级
        if (this.level >= this.MAX_LEVEL) {
            console.log(`防御塔已达最大等级，无法继续合成`);
            return false;
        }
        
        // 新逻辑：只能吸收同类型的 LV1 塔
        if (otherTower.towerId !== this.towerId) {
            console.log(`合成失败：类型不匹配。当前: ${this.towerId}, 目标: ${otherTower.towerId}`);
            return false;
        }
        
        if (otherTower.level !== 1) {
            console.log(`合成失败：只能吸收 LV1 的塔。目标等级: LV${otherTower.level}`);
            return false;
        }
        
        // 记录合成前的状态
        const oldExp = this.currentExp;
        const oldLevel = this.level;
        const needed = this.nextLevelNeeded;
        
        this.currentExp += 1;
        console.log(`合成中：${this.towerId} LV${this.level} (${oldExp}/${needed}) -> (${this.currentExp}/${needed})`);
        
        if (this.currentExp >= needed) {
            this.level++;
            this.currentExp = 0;
            
            console.log(`升级成功：${this.towerId} LV${oldLevel} -> LV${this.level}`);
            
            // 升级属性增长
            const baseDamage = this.towerData?.baseDamage || 5;
            this.damage = Math.floor(baseDamage * (1 + (this.level - 1) * GameConfig.TOWER_DAMAGE_GROWTH_PER_LEVEL));
            this.attackInterval = Math.max(
                0.3,
                (this.towerData?.baseAttackInterval || 1.2) - (this.level - 1) * 0.1
            );
        } else {
            console.log(`合成成功但未升级：${this.towerId} LV${this.level} (${this.currentExp}/${this.nextLevelNeeded})`);
        }
        
        this.updateUI();
        this.updateAppearance();
        return true;
    }
    
    /**
     * 检查是否可以吸收另一个塔
     */
    public canAbsorb(otherTower: Tower): boolean {
        if (this.level >= this.MAX_LEVEL) return false;
        if (otherTower.towerId !== this.towerId) return false;
        if (otherTower.level !== 1) return false;
        return true;
    }

    updateUI() {
        // 预览模式下不显示顶部信息
        if (this.isPreviewMode) {
            // 隐藏等级指示器
            const indicator = this.node.getChildByName("LevelIndicator");
            if (indicator) {
                indicator.active = false;
            }
            if (this.levelLabel) {
                this.levelLabel.node.active = false;
            }
            // 缩放贴图
            const s = GameConfig.TOWER_BASE_SCALE;
            this.node.setScale(v3(s, s, 1));
            return;
        }
        
        if (this.levelLabel) {
            // 显示防御塔名称、品质、等级
            if (this.towerData) {
                const rarityColor = TowerConfig.getRarityColor(this.towerData.rarity);
                
                // 绘制等级指示器（整合显示）
                this.drawLevelIndicator(rarityColor);
                
                // 隐藏原有的levelLabel，改用绘制的方式
                this.levelLabel.node.active = false;
            }
        }
        
        // 缩放贴图
        const s = GameConfig.TOWER_BASE_SCALE + (this.level - 1) * GameConfig.TOWER_SCALE_PER_LEVEL;
        this.node.setScale(v3(s, s, 1));
        
        // 对指示器反向缩放，保持大小不变
        const indicator = this.node.getChildByName("LevelIndicator");
        if (indicator) {
            const inverseScale = 1 / s;
            indicator.setScale(v3(inverseScale, inverseScale, 1));
        }
    }

    /**
     * 绘制等级指示器
     * 参考图布局：
     * 第一行：五角星表示等级（1-4颗星）
     * 第二行：合成进度格子
     * 第三行：防御塔名称
     */
    private drawLevelIndicator(color: Color) {
        let indicator = this.node.getChildByName("LevelIndicator");
        if (!indicator) {
            indicator = new Node("LevelIndicator");
            this.node.addChild(indicator);
            indicator.setSiblingIndex(999);
        }
        
        // 位置：防御塔头顶
        indicator.setPosition(v3(0, 70, 0));

        let g = indicator.getComponent(Graphics);
        if (!g) g = indicator.addComponent(Graphics);
        
        g.clear();
        
        // === 第一行：五角星表示等级 ===
        const starY = 8;
        const starSize = 8;  // 星星大小
        const starGap = 2;   // 星星间距
        const maxStars = this.MAX_LEVEL;  // 最多4颗星
        const totalStarWidth = maxStars * starSize * 2 + (maxStars - 1) * starGap;
        const starStartX = -totalStarWidth / 2 + starSize;
        
        for (let i = 0; i < maxStars; i++) {
            const cx = starStartX + i * (starSize * 2 + starGap);
            const cy = starY;
            
            if (i < this.level) {
                // 亮星（金色）
                g.fillColor = new Color(255, 200, 50, 255);
                this.drawStar(g, cx, cy, starSize, starSize * 0.4);
                g.fill();
            } else {
                // 暗星（灰色轮廓）
                g.strokeColor = new Color(100, 100, 100, 150);
                g.lineWidth = 1;
                this.drawStar(g, cx, cy, starSize * 0.8, starSize * 0.3);
                g.stroke();
            }
        }
        
        // === 第二行：合成进度格子 ===
        const barY = -6;
        const slotWidth = 14;   // 格子宽度
        const slotHeight = 8;   // 格子高度
        const slotGap = 2;      // 格子间距
        
        if (this.level < this.MAX_LEVEL) {
            const neededForNext = this.nextLevelNeeded;
            const totalSlots = neededForNext + 1;
            const currentFilled = this.currentExp + 1;
            
            const totalWidth = totalSlots * slotWidth + (totalSlots - 1) * slotGap;
            const startX = -totalWidth / 2;
            
            for (let i = 0; i < totalSlots; i++) {
                const x = startX + i * (slotWidth + slotGap);
                
                // 格子内容
                if (i < currentFilled) {
                    g.fillColor = new Color(80, 200, 80, 255);  // 已合成：亮绿色
                } else {
                    g.fillColor = new Color(50, 45, 40, 255);   // 未合成：深灰褐色
                }
                g.rect(x, barY - slotHeight/2, slotWidth, slotHeight);
                g.fill();
                
                // 格子边框（深灰色，细线）
                g.strokeColor = new Color(20, 20, 20, 255);
                g.lineWidth = 1;
                g.rect(x, barY - slotHeight/2, slotWidth, slotHeight);
                g.stroke();
            }
        } else {
            // MAX等级：显示满格金色条
            const maxWidth = 50;
            // 填充
            g.fillColor = new Color(255, 200, 50, 255);
            g.rect(-maxWidth/2, barY - slotHeight/2, maxWidth, slotHeight);
            g.fill();
            // 边框（深灰色）
            g.strokeColor = new Color(20, 20, 20, 255);
            g.lineWidth = 1;
            g.rect(-maxWidth/2, barY - slotHeight/2, maxWidth, slotHeight);
            g.stroke();
        }
        
        // === 第三行：防御塔名称 ===
        let nameLabel = indicator.getChildByName("NameLabel");
        if (!nameLabel) {
            nameLabel = new Node("NameLabel");
            indicator.addChild(nameLabel);
            const nl = nameLabel.addComponent(Label);
            nl.fontSize = 16;  // 略微放大字号
            nl.enableOutline = true;
            nl.outlineWidth = 2;
            nl.horizontalAlign = Label.HorizontalAlign.CENTER;
            nl.verticalAlign = Label.VerticalAlign.CENTER;
            
            const transform = nameLabel.addComponent(UITransform);
            transform.setContentSize(100, 22);
        }
        nameLabel.setPosition(v3(0, -20, 0));
        const nameLabelComp = nameLabel.getComponent(Label)!;
        nameLabelComp.string = this.towerData?.name || "";
        nameLabelComp.color = color;  // 品质色
        nameLabelComp.outlineColor = Color.BLACK;
    }
    
    /**
     * 绘制五角星路径
     */
    private drawStar(g: Graphics, cx: number, cy: number, outerR: number, innerR: number) {
        const points = 5;
        const angleStep = Math.PI / points;
        
        // 从顶部开始绘制（Cocos的Y轴向上，所以+Math.PI/2让尖端朝上）
        const startAngle = Math.PI / 2;
        
        for (let i = 0; i < points * 2; i++) {
            const r = i % 2 === 0 ? outerR : innerR;
            const angle = startAngle + i * angleStep;
            const x = cx + r * Math.cos(angle);
            const y = cy + r * Math.sin(angle);
            
            if (i === 0) {
                g.moveTo(x, y);
            } else {
                g.lineTo(x, y);
            }
        }
        g.close();  // 使用close()正确闭合路径
    }

    /**
     * 更新外观（品质颜色和贴图）
     */
    updateAppearance() {
        // 如果是拖拽预览，不修改名称（保持为"DragPreview"以便检测逻辑排除）
        const isDragPreview = this.node.name === "DragPreview";
        
        // 如果没有towerSprite，尝试获取或创建
        if (!this.towerSprite && this.towerData) {
            // 尝试从节点本身获取Sprite
            this.towerSprite = this.node.getComponent(Sprite);
            // 如果还没有，尝试从子节点获取
            if (!this.towerSprite) {
                const spriteNode = this.node.children.find(n => n.getComponent(Sprite));
                if (spriteNode) {
                    this.towerSprite = spriteNode.getComponent(Sprite);
                }
            }
        }
        
        if (this.towerSprite && this.towerData) {
            // 不再添加品质颜色覆盖，保持贴图原色
            this.towerSprite.color = Color.WHITE;
            
            // 加载对应的贴图
            if (this.towerData.spriteTexture) {
                this.loadTowerTexture(this.towerData.spriteTexture);
            }
        }
        
        // 更新节点名称显示品质和类型（但拖拽预览保持原名称）
        if (this.towerData && !isDragPreview) {
            const rarityName = TowerConfig.getRarityName(this.towerData.rarity);
            this.node.name = `${this.towerData.name}_${rarityName}_LV${this.level}`;
        }
    }
    
    private readonly DEFAULT_TEXTURE = "tower";  // 默认贴图
    
    /**
     * 加载防御塔贴图
     */
    private loadTowerTexture(textureName: string, isRetry: boolean = false) {
        if (!this.towerSprite) return;
        
        // 从 resources/Textures 目录加载贴图
        resources.load(`Textures/${textureName}/spriteFrame`, SpriteFrame, (err, spriteFrame) => {
            if (err) {
                // 尝试直接加载纹理
                resources.load(`Textures/${textureName}`, Texture2D, (err2, texture) => {
                    if (err2) {
                        console.warn(`加载贴图失败: ${textureName}`, err2);
                        // 保底逻辑：加载失败时使用默认贴图
                        if (!isRetry && textureName !== this.DEFAULT_TEXTURE) {
                            console.log(`使用默认贴图: ${this.DEFAULT_TEXTURE}`);
                            this.loadTowerTexture(this.DEFAULT_TEXTURE, true);
                        }
                        return;
                    }
                    if (this.towerSprite && this.towerSprite.isValid) {
                        const newFrame = new SpriteFrame();
                        newFrame.texture = texture;
                        this.towerSprite.spriteFrame = newFrame;
                        this.ensureSpriteAnchor();
                    }
                });
                return;
            }
            if (this.towerSprite && this.towerSprite.isValid) {
                this.towerSprite.spriteFrame = spriteFrame;
                this.ensureSpriteAnchor();
            }
        });
    }
    
    /**
     * 确保精灵锚点居中
     */
    private ensureSpriteAnchor() {
        // 确保节点的 UITransform 锚点居中
        const transform = this.node.getComponent(UITransform);
        if (transform) {
            transform.anchorX = 0.5;
            transform.anchorY = 0.5;  // 中心锚点
        }
        
        // 如果 towerSprite 在子节点上，也确保其锚点居中
        if (this.towerSprite && this.towerSprite.node !== this.node) {
            const spriteTransform = this.towerSprite.node.getComponent(UITransform);
            if (spriteTransform) {
                spriteTransform.anchorX = 0.5;
                spriteTransform.anchorY = 0.5;  // 中心锚点
            }
            // 确保子节点位置在原点
            this.towerSprite.node.setPosition(v3(0, 0, 0));
        }
    }

    update(dt: number) {
        // 重要：如果是拖拽预览，不执行攻击逻辑
        if (this.node.name === "DragPreview") {
            return;
        }
        
        // 重要：如果游戏已结束，停止所有攻击逻辑
        if (TouchManager.isGameOver) {
            return;
        }
        
        // 每帧根据Y坐标动态调整层级（确保下方的防御塔在上方的前面）
        this.updateZIndexByPosition();
        
        // 更新buff计时器
        if (this.buffTimer > 0) {
            this.buffTimer -= dt;
            if (this.buffTimer <= 0) {
                this.damageBuff = 0;
                this.speedBuff = 0;
            }
        }

        this.attackTimer += dt;
        this.skillTimer += dt;
        
        // 应用速度buff
        const actualInterval = this.attackInterval * (1 - this.speedBuff);
        
        if (this.attackTimer >= actualInterval) {
            this.shoot();
            this.attackTimer = 0;
        }
        
        // 技能冷却检查
        if (this.towerData && this.towerData.skillType !== SkillType.NONE) {
            const skillCooldown = this.towerData.skillCooldown || 0;
            if (skillCooldown > 0 && this.skillTimer >= skillCooldown) {
                this.useSkill();
                this.skillTimer = 0;
            }
        }
    }

    /**
     * 普通攻击
     */
    shoot() {
        const target = this.findNearestEnemy();
        if (!target || !this.bulletPrefab) return;
        
        if (!this.canvas) {
            this.canvas = find("Canvas");
        }
        if (!this.canvas) return;
        
        const bulletNode = instantiate(this.bulletPrefab);
        this.canvas.addChild(bulletNode);
        bulletNode.setPosition(this.node.getPosition());
        
        const bulletScript = bulletNode.getComponent(Bullet);
        if (bulletScript) {
            // 计算最终伤害（基础伤害 + buff）
            const finalDamage = Math.floor(this.damage * (1 + this.damageBuff));
            bulletScript.setTarget(target);
            bulletScript.damage = finalDamage;
            // 传递技能信息给子弹（用于溅射、连锁等）
            if (this.towerData) {
                (bulletScript as any).towerData = this.towerData;
                (bulletScript as any).towerLevel = this.level;
            }
        }
    }

    /**
     * 使用技能
     */
    useSkill() {
        if (!this.towerData || !this.canvas) return;
        
        const skillType = this.towerData.skillType;
        const skillValue = this.towerData.skillValue;
        
        switch (skillType) {
            case SkillType.AOE_DAMAGE:
                this.useAOESkill(skillValue);
                break;
            case SkillType.BUFF_DAMAGE:
                this.useBuffDamageSkill(skillValue);
                break;
            case SkillType.BUFF_SPEED:
                this.useBuffSpeedSkill(skillValue);
                break;
            // SLOW和SPLASH在攻击时自动触发，不需要主动技能
            // CHAIN在Bullet中处理
        }
    }

    /**
     * AOE范围伤害技能
     */
    private useAOESkill(damageMultiplier: number) {
        const enemies = this.findEnemiesInRange(this.range);
        enemies.forEach(enemy => {
            const enemyScript = enemy.getComponent(Enemy);
            if (enemyScript) {
                const aoeDamage = Math.floor(this.damage * damageMultiplier);
                enemyScript.takeDamage(aoeDamage);
            }
        });
    }

    /**
     * 增加友军伤害buff
     */
    private useBuffDamageSkill(buffValue: number) {
        // 找到范围内的所有友军塔
        const nearbyTowers = this.findTowersInRange(this.range * 1.5);
        nearbyTowers.forEach(tower => {
            const towerScript = tower.getComponent(Tower);
            if (towerScript && towerScript !== this) {
                towerScript.damageBuff = buffValue;
                towerScript.buffTimer = 5.0; // 5秒buff
            }
        });
    }

    /**
     * 增加友军攻击速度buff
     */
    private useBuffSpeedSkill(buffValue: number) {
        const nearbyTowers = this.findTowersInRange(this.range * 1.5);
        nearbyTowers.forEach(tower => {
            const towerScript = tower.getComponent(Tower);
            if (towerScript && towerScript !== this) {
                towerScript.speedBuff = buffValue;
                towerScript.buffTimer = 5.0;
            }
        });
    }

    /**
     * 查找范围内的敌人
     */
    private findEnemiesInRange(range: number): Node[] {
        if (!this.canvas) return [];
        const towerPos = this.node.getPosition();
        return this.canvas.children.filter(n => {
            if (n.name === "Enemy" && n.isValid) {
                return Vec3.distance(towerPos, n.getPosition()) <= range;
            }
            return false;
        });
    }

    /**
     * 查找范围内的防御塔
     */
    private findTowersInRange(range: number): Node[] {
        if (!this.canvas) return [];
        const towerPos = this.node.getPosition();
        return this.canvas.children.filter(n => {
            if (n.name.includes("Tower_Instance") && n.isValid && n !== this.node) {
                return Vec3.distance(towerPos, n.getPosition()) <= range;
            }
            return false;
        });
    }

    findNearestEnemy(): Node | null {
        if (!this.canvas) {
            this.canvas = find("Canvas");
        }
        if (!this.canvas) return null;
        
        const enemies = this.canvas.children.filter(n => n.name === "Enemy" && n.isValid);
        if (enemies.length === 0) return null;
        
        let nearest: Node | null = null;
        let minDist = this.range;
        const towerPos = this.node.getPosition();
        
        enemies.forEach(e => {
            const d = Vec3.distance(towerPos, e.getPosition());
            if (d < minDist) { 
                minDist = d; 
                nearest = e; 
            }
        });
        
        return nearest;
    }
    
    /**
     * 创建标签背景（半透明黑色）
     */
    private createLabelBackground() {
        if (!this.levelLabel || this.labelBackground) return;
        
        // 创建背景节点
        this.labelBackground = new Node("LabelBackground");
        this.levelLabel.node.parent?.addChild(this.labelBackground);
        
        // 设置背景在标签之后（先渲染）
        const labelIndex = this.levelLabel.node.getSiblingIndex();
        this.labelBackground.setSiblingIndex(labelIndex);
        this.levelLabel.node.setSiblingIndex(labelIndex + 1);
        
        // 添加Graphics组件绘制半透明黑色矩形
        const graphics = this.labelBackground.addComponent(Graphics);
        graphics.fillColor = new Color(0, 0, 0, 180);  // 半透明黑色
        
        // 设置背景位置和大小
        this.updateLabelBackground();
    }
    
    /**
     * 更新标签背景大小（延迟执行以确保Label已更新尺寸）
     */
    private updateLabelBackground() {
        if (!this.labelBackground || !this.levelLabel) return;
        
        // 延迟一帧更新，确保Label的contentSize已经根据新文本更新
        this.scheduleOnce(() => {
            if (!this.labelBackground || !this.levelLabel || !this.labelBackground.isValid) return;
            
            const graphics = this.labelBackground.getComponent(Graphics);
            if (!graphics) return;
            
            // 获取标签的UITransform
            const labelTransform = this.levelLabel.node.getComponent(UITransform);
            if (!labelTransform) return;
            
            // 强制更新Label的布局，确保contentSize是最新的
            this.levelLabel.updateRenderData(true);
            
            // 清除之前的绘制
            graphics.clear();
            
            // 绘制圆角矩形背景（紧凑设计）
            const padding = 4;  // 减小内边距，更紧凑
            const width = labelTransform.width + padding * 2;
            const height = labelTransform.height + padding * 2;
            
            // 不设置最小尺寸，让背景自适应文字大小
            const finalWidth = Math.max(width, 60);  // 降低最小宽度
            const finalHeight = Math.max(height, 30); // 降低最小高度
            
            // 使用更透明的背景（降低不透明度）
            graphics.fillColor = new Color(0, 0, 0, 120);  // 从180降到120，更透明
            graphics.roundRect(-finalWidth / 2, -finalHeight / 2, finalWidth, finalHeight, 3);
            graphics.fill();
            
            // 设置背景位置与标签一致
            this.labelBackground.setPosition(this.levelLabel.node.getPosition());
        }, 0.05);
    }
    
    /**
     * 添加精灵描边效果
     */
    private addSpriteOutline() {
        if (!this.towerSprite) return;
        
        // 通过调整材质实现描边效果
        // 注意：Cocos Creator的Sprite组件本身不支持描边，这里我们通过颜色增强来提升可见度
        // 如果需要真正的描边，需要使用自定义shader或多层精灵
        
        // 暂时通过增加对比度来提升可见度
        // 实际项目中可以考虑使用描边shader或创建描边精灵
    }
    
    /**
     * 根据Y坐标动态调整层级（Y值越小，越在下方，层级越高）
     * 与怪物使用相同的层级计算公式，确保防御塔和怪物之间也能正确遮挡
     */
    private updateZIndexByPosition() {
        if (!this.node || !this.node.isValid) return;
        if (!this.node.parent) return;
        
        // 如果是拖拽预览，不调整层级
        if (this.node.name === "DragPreview") {
            return;
        }
        
        // 如果当前节点层级非常高（>=9000，正在被拖拽），不调整
        if (this.node.getSiblingIndex() >= 9000) {
            return;
        }
        
        // Y坐标范围约 -400 到 400
        // 映射到层级 200-399（高于怪物的20-199，但低于商店面板500）
        // Y=-400（最下方）→ 层级399（最高）
        // Y=400（最上方）→ 层级200（最低）
        // 防御塔层级比怪物高，这样怪物不会遮挡防御塔
        const yPos = this.node.position.y;
        const zIndex = Math.floor(399 - (yPos + 400) * 199 / 800);
        const clampedIndex = Math.max(200, Math.min(399, zIndex));
        
        if (this.node.getSiblingIndex() !== clampedIndex) {
            this.node.setSiblingIndex(clampedIndex);
        }
    }
}
