import { _decorator, Component, Vec3, Node, find, v3, Label, Color, Sprite, Graphics, UITransform, resources, SpriteFrame, Texture2D } from 'cc';
import { TouchManager } from './TouchManager';
import { TileSlot, TileType } from './TileSlot';
import { GameConfig } from './GameConfig';

const { ccclass, property } = _decorator;

/**
 * 敌人类型枚举
 */
export enum EnemyType { 
    NORMAL = 0,   // 普通怪物
    FAST = 1,     // 快速怪物（小型、快速、血少）
    TANK = 2,     // 坦克怪物（大型、缓慢、血厚）
    ELITE = 3,    // 精英怪物（中型、较快、血多）
    BOSS = 4      // Boss怪物（巨型、缓慢、血极厚）
}

/**
 * 敌人贴图配置
 * 当你上传贴图后，修改这里的贴图名称即可
 */
export const EnemyTextureConfig: { [key: number]: string } = {
    [EnemyType.NORMAL]: "enemy_normal",   // 普通怪物贴图
    [EnemyType.FAST]: "enemy_fast",       // 快速怪物贴图
    [EnemyType.TANK]: "enemy_tank",       // 坦克怪物贴图
    [EnemyType.ELITE]: "enemy_elite",     // 精英怪物贴图
    [EnemyType.BOSS]: "enemy_boss"        // Boss怪物贴图
};

const DEFAULT_ENEMY_TEXTURE = "enemy";  // 默认贴图（当指定贴图不存在时使用）

@ccclass('Enemy')
export class Enemy extends Component {
    @property(Node) public hpFillBar: Node = null!;
    @property(Label) public hpLabel: Label = null!;
    @property(Sprite) public bodySprite: Sprite = null!; 

    public hp: number = 5;  // 整数
    public maxHp: number = 5;  // 整数
    public speed: number = 100;
    public enemyType: EnemyType = EnemyType.NORMAL;  // 敌人类型
    private waypointPositions: Vec3[] = []; 
    private currentWaypointIndex: number = 0;
    private gridMap: Node | null = null;
    private originalSpeed: number = 100;  // 用于减速效果
    private killReward: number = 2;  // 击杀奖励（直接存储金币数）
    private baseScale: number = 1;  // 基础缩放值（用于翻转时保持大小）
    private spawnOrder: number = 0;  // 生成顺序（用于同Y坐标时的层级排序）
    private slowEndTime: number = 0;  // 减速结束时间戳（用于正确处理多个冰法的减速）

    /**
     * 初始化敌人
     * @param wave 当前波次（用于计算血量和奖励增长）
     * @param type 敌人类型
     * 
     * 设计理念：同一种怪物在不同波次血量和奖励都会增长
     * 血量公式：(基础血量 + (波次-1) × 每波增长) × 阶梯加成
     * 阶梯加成：1-10波×1.0，11-20波×1.5，21-30波×2.5
     * 奖励公式：基础奖励 + floor((波次-1) / 5) × 奖励增长
     */
    public init(wave: number, type: EnemyType = EnemyType.NORMAL) {
        this.enemyType = type;
        const waveBonus = Math.max(0, wave - 1);  // 波次加成（从第2波开始增长）
        const rewardTier = Math.floor(waveBonus / 5);  // 每5波奖励提升一档
        
        // 计算阶梯血量加成
        let hpMultiplier = 1.0;
        if (wave >= 21) {
            hpMultiplier = GameConfig.HP_MULTIPLIER_WAVE_21_30;  // 2.5倍
        } else if (wave >= 11) {
            hpMultiplier = GameConfig.HP_MULTIPLIER_WAVE_11_20;  // 1.5倍
        }
        
        // 根据怪物类型设置属性（血量和奖励随波次增长）
        switch (type) {
            case EnemyType.FAST:
                // 快速怪物（蝙蝠）：血少、速度快
                this.maxHp = (GameConfig.FAST_ENEMY_BASE_HP + waveBonus * GameConfig.FAST_ENEMY_HP_PER_WAVE) * hpMultiplier;
                this.speed = GameConfig.FAST_ENEMY_SPEED;
                this.killReward = GameConfig.FAST_ENEMY_BASE_REWARD + rewardTier * GameConfig.FAST_ENEMY_REWARD_PER_5WAVE;
                this.setScale(0.7);
                break;
                
            case EnemyType.TANK:
                // 坦克怪物（哥布林）：血厚、速度慢
                this.maxHp = (GameConfig.TANK_ENEMY_BASE_HP + waveBonus * GameConfig.TANK_ENEMY_HP_PER_WAVE) * hpMultiplier;
                this.speed = GameConfig.TANK_ENEMY_SPEED;
                this.killReward = GameConfig.TANK_ENEMY_BASE_REWARD + rewardTier * GameConfig.TANK_ENEMY_REWARD_PER_5WAVE;
                this.setScale(1.3);
                break;
                
            case EnemyType.ELITE:
                // 精英怪物（骷髅战士）：血多、速度中等
                this.maxHp = (GameConfig.ELITE_ENEMY_BASE_HP + waveBonus * GameConfig.ELITE_ENEMY_HP_PER_WAVE) * hpMultiplier;
                this.speed = GameConfig.ELITE_ENEMY_SPEED;
                this.killReward = GameConfig.ELITE_ENEMY_BASE_REWARD + rewardTier * GameConfig.ELITE_ENEMY_REWARD_PER_5WAVE;
                this.setScale(1.2);
                break;
                
            case EnemyType.BOSS:
                // Boss怪物：固定血量（不受阶梯加成影响），不给钱
                this.maxHp = GameConfig.BOSS_ENEMY_HP;
                this.speed = GameConfig.BOSS_ENEMY_SPEED;
                this.killReward = GameConfig.BOSS_ENEMY_REWARD;
                this.setScale(1.8);
                break;
                
            default:
                // 普通怪物（史莱姆）
                this.maxHp = (GameConfig.NORMAL_ENEMY_BASE_HP + waveBonus * GameConfig.NORMAL_ENEMY_HP_PER_WAVE) * hpMultiplier;
                this.speed = GameConfig.NORMAL_ENEMY_SPEED;
                this.killReward = GameConfig.NORMAL_ENEMY_BASE_REWARD + rewardTier * GameConfig.NORMAL_ENEMY_REWARD_PER_5WAVE;
                this.setScale(1.0);
                break;
        }
        
        this.originalSpeed = this.speed;
        
        // 确保至少1点血量，取整
        this.maxHp = Math.max(1, Math.floor(this.maxHp));
        this.hp = this.maxHp;
        this.updateHealthUI();
        
        // 加载对应贴图
        this.loadEnemyTexture(type);
    }
    
    /**
     * 设置敌人贴图缩放（只缩放贴图，不影响血条UI）
     */
    private setScale(scale: number) {
        this.baseScale = scale;
        // 缩放会在加载贴图后应用
    }
    
    /**
     * 应用贴图缩放（在贴图加载完成后调用）
     * 同时确保血条UI保持原始大小
     */
    private applySpriteScale() {
        if (this.bodySprite && this.bodySprite.node) {
            this.bodySprite.node.setScale(v3(this.baseScale, this.baseScale, 1));
        }
        
        // 确保血条UI保持原始大小（反向缩放）
        this.ensureHealthBarSize();
    }
    
    /**
     * 确保血条UI保持原始大小
     * 如果血条是bodySprite的子节点，需要反向缩放
     */
    private ensureHealthBarSize() {
        const inverseScale = 1 / this.baseScale;
        
        // 检查血条父节点并反向缩放
        if (this.hpFillBar && this.hpFillBar.parent) {
            const hpParent = this.hpFillBar.parent;
            // 如果血条父节点是bodySprite或其子节点，需要反向缩放
            if (this.isChildOf(hpParent, this.bodySprite?.node)) {
                hpParent.setScale(v3(inverseScale, inverseScale, 1));
            }
        }
        
        // 检查血量文字并反向缩放
        if (this.hpLabel && this.hpLabel.node && this.hpLabel.node.parent) {
            const labelParent = this.hpLabel.node.parent;
            // 如果文字父节点是bodySprite或其子节点，需要反向缩放
            if (this.isChildOf(labelParent, this.bodySprite?.node)) {
                // 如果文字和血条在同一个父节点，已经处理过了
                if (labelParent !== this.hpFillBar?.parent) {
                    labelParent.setScale(v3(inverseScale, inverseScale, 1));
                }
            }
        }
    }
    
    /**
     * 检查节点是否是另一个节点的子节点（包括自身）
     */
    private isChildOf(node: Node | null, parent: Node | null | undefined): boolean {
        if (!node || !parent) return false;
        let current: Node | null = node;
        while (current) {
            if (current === parent) return true;
            current = current.parent;
        }
        return false;
    }
    
    /**
     * 加载敌人贴图
     */
    private loadEnemyTexture(type: EnemyType) {
        if (!this.bodySprite) return;
        
        // 初始隐藏贴图
        this.bodySprite.node.active = false;
        
        const textureName = EnemyTextureConfig[type] || DEFAULT_ENEMY_TEXTURE;
        
        resources.load(`Textures/${textureName}/spriteFrame`, SpriteFrame, (err, spriteFrame) => {
            if (err) {
                // 尝试直接加载纹理
                resources.load(`Textures/${textureName}`, Texture2D, (err2, texture) => {
                    if (err2) {
                        // 加载失败，尝试默认贴图
                        if (textureName !== DEFAULT_ENEMY_TEXTURE) {
                            this.loadDefaultTexture();
                        } else {
                            // 默认贴图也加载失败，显示原有贴图
                            if (this.bodySprite) {
                                this.applySpriteScale();
                                this.bodySprite.node.active = true;
                            }
                        }
                        return;
                    }
                    if (this.bodySprite && this.bodySprite.isValid) {
                        const newFrame = new SpriteFrame();
                        newFrame.texture = texture;
                        this.bodySprite.spriteFrame = newFrame;
                        this.applySpriteScale();
                        this.bodySprite.node.active = true;
                    }
                });
                return;
            }
            if (this.bodySprite && this.bodySprite.isValid) {
                this.bodySprite.spriteFrame = spriteFrame;
                this.applySpriteScale();
                this.bodySprite.node.active = true;
            }
        });
    }
    
    /**
     * 加载默认贴图
     */
    private loadDefaultTexture() {
        if (!this.bodySprite) return;
        
        resources.load(`Textures/${DEFAULT_ENEMY_TEXTURE}/spriteFrame`, SpriteFrame, (err, spriteFrame) => {
            if (err) {
                resources.load(`Textures/${DEFAULT_ENEMY_TEXTURE}`, Texture2D, (err2, texture) => {
                    if (err2) {
                        // 都加载失败，显示原有贴图
                        if (this.bodySprite) {
                            this.applySpriteScale();
                            this.bodySprite.node.active = true;
                        }
                        return;
                    }
                    if (this.bodySprite && this.bodySprite.isValid) {
                        const newFrame = new SpriteFrame();
                        newFrame.texture = texture;
                        this.bodySprite.spriteFrame = newFrame;
                        this.applySpriteScale();
                        this.bodySprite.node.active = true;
                    }
                });
                return;
            }
            if (this.bodySprite && this.bodySprite.isValid) {
                this.bodySprite.spriteFrame = spriteFrame;
                this.applySpriteScale();
                this.bodySprite.node.active = true;
            }
        });
    }

    private updateHealthUI() {
        if (this.hpFillBar) this.hpFillBar.setScale(v3(Math.max(0, this.hp / this.maxHp), 1, 1));
        if (this.hpLabel) this.hpLabel.string = `${Math.max(0, Math.floor(this.hp))}/${this.maxHp}`;
    }

    public takeDamage(damage: number) {
        // 确保伤害是整数
        const intDamage = Math.floor(damage);
        this.hp = Math.max(0, this.hp - intDamage);
        this.updateHealthUI();
        
        // 记录总伤害（用于胜利结算）
        TouchManager.totalDamage += intDamage;
        
        if (this.hp <= 0 && this.node && this.node.isValid) {
            // 使用计算好的击杀奖励
            TouchManager.money += this.killReward;
            TouchManager.totalGoldEarned += this.killReward;  // 记录赚取的金币
            console.log(`怪物被击杀，获得 ${this.killReward} 金币，当前金币: ${TouchManager.money}`);
            this.node.destroy();
        }
    }

    start() { 
        this.gridMap = find("Canvas/GridMap");
        this.generatePath(); 
    }

    generatePath() {
        if (!this.gridMap) {
            this.gridMap = find("Canvas/GridMap");
        }
        if (!this.gridMap) return;
        
        let startTile: Node | null = null;
        let endTile: Node | null = null;
        const pathTiles: Node[] = [];
        
        // 收集所有路径节点
        for (const child of this.gridMap.children) {
            const slot = child.getComponent(TileSlot);
            if (!slot) continue;
            
            if (slot.type === TileType.START) {
                startTile = child;
            } else if (slot.type === TileType.END) {
                endTile = child;
            } else if (slot.type === TileType.PATH) {
                pathTiles.push(child);
            }
        }
        
        if (!startTile || !endTile) return;
        
        // 使用改进的路径查找算法：从起点到终点，按距离顺序连接路径点
        this.waypointPositions = [startTile.getPosition()];
        let currentPos = startTile.getPosition();
        const remaining = [...pathTiles];
        const endPos = endTile.getPosition();
        
        // 贪心算法：每次选择距离当前点最近且更接近终点的路径点
        while (remaining.length > 0) {
            // 找到既接近当前点，又接近终点的路径点
            remaining.sort((a, b) => {
                const aPos = a.getPosition();
                const bPos = b.getPosition();
                const distA = Vec3.distance(aPos, currentPos);
                const distB = Vec3.distance(bPos, currentPos);
                const distToEndA = Vec3.distance(aPos, endPos);
                const distToEndB = Vec3.distance(bPos, endPos);
                // 优先选择距离当前点近且更接近终点的点
                return (distA + distToEndA * 0.3) - (distB + distToEndB * 0.3);
            });
            
            const next = remaining.shift()!;
            this.waypointPositions.push(next.getPosition());
            currentPos = next.getPosition();
        }
        
        // 最后添加终点
        this.waypointPositions.push(endPos);
    }

    private lastDirection: number = 1;  // 1=右, -1=左

    update(dt: number) {
        if (this.waypointPositions.length === 0 || TouchManager.isGameOver || this.currentWaypointIndex >= this.waypointPositions.length) return;
        const targetPos = this.waypointPositions[this.currentWaypointIndex];
        const currentPos = this.node.getPosition();
        const dir = v3();
        Vec3.subtract(dir, targetPos, currentPos);
        if (dir.length() < GameConfig.ENEMY_WAYPOINT_REACH_DISTANCE) {
            this.currentWaypointIndex++;
            if (this.currentWaypointIndex >= this.waypointPositions.length) {
                TouchManager.baseHealth -= 1;
                this.node.destroy();
            }
        } else {
            dir.normalize();
            this.node.setPosition(currentPos.add(dir.multiplyScalar(this.speed * dt)));
            
            // 根据移动方向翻转贴图
            this.updateSpriteDirection(dir.x);
        }
        
        // 每帧根据Y坐标更新层级（Y越小，层级越高）
        this.updateZIndexByY();
    }
    
    /**
     * 根据生成顺序设置层级（只在生成时设置一次）
     * 
     * 核心规则：先创建的怪物显示在上层，遮挡后创建的怪物
     * 就这么简单，不需要考虑坐标、方向等复杂情况
     * 
     * 注意：这个方法现在只是保持兼容，实际层级在 setSpawnOrder 中设置
     */
    private updateZIndexByY() {
        // 层级已经在 setSpawnOrder 中设置，这里不需要每帧更新
        // 保留这个方法是为了兼容性
    }
    
    /**
     * 设置生成顺序并立即设置层级（由WaveSystem调用）
     * 
     * 核心规则：先创建的怪物显示在上层，遮挡后创建的怪物
     * 
     * Cocos的setSiblingIndex：
     * - 数值越大，渲染越晚，显示在越上层
     * - 新添加的节点默认在最后（sibling index 最大）
     * 
     * 实现方式：
     * - 新怪物添加后默认就在最上层
     * - 我们把它移到一个固定的较低位置
     * - 这样先创建的怪物会被"推"到更高的位置，显示在上层
     */
    public setSpawnOrder(order: number) {
        this.spawnOrder = order;
        
        if (this.node && this.node.parent) {
            // 找到一个基准位置：在 GridMap 之后，在商店/TopBar 之前
            // 把新怪物插入到这个位置，之前的怪物会自动往后移（sibling index 变大）
            // 这样先创建的怪物 sibling index 更大，显示在上层
            const gridMap = this.node.parent.getChildByName("GridMap");
            if (gridMap) {
                const baseIndex = gridMap.getSiblingIndex() + 1;
                this.node.setSiblingIndex(baseIndex);
            } else {
                // 如果没有 GridMap，就放到位置 5
                this.node.setSiblingIndex(5);
            }
        }
    }

    /**
     * 应用减速效果
     * 
     * 设计理念：多个冰法的减速效果不叠加，而是重置持续时长
     * - 减速百分比取最大值（如果新的减速更强则更新）
     * - 持续时间重置（延长减速结束时间）
     */
    public applySlow(slowPercent: number, duration: number) {
        const currentTime = Date.now();
        const newEndTime = currentTime + duration * 1000;
        
        // 计算新的减速后速度
        const newSlowedSpeed = Math.floor(this.originalSpeed * (1 - slowPercent));
        
        // 如果当前没有减速，或者新的减速更强，则更新速度
        if (this.speed >= this.originalSpeed || newSlowedSpeed < this.speed) {
            this.speed = newSlowedSpeed;
        }
        
        // 重置减速结束时间（取更晚的时间）
        if (newEndTime > this.slowEndTime) {
            this.slowEndTime = newEndTime;
            
            // 取消之前的恢复定时器，设置新的
            this.unschedule(this.recoverFromSlow);
            this.scheduleOnce(this.recoverFromSlow, duration);
        }
    }
    
    /**
     * 从减速中恢复
     */
    private recoverFromSlow() {
        if (this.node && this.node.isValid) {
            // 只有当当前时间已经超过减速结束时间才恢复
            if (Date.now() >= this.slowEndTime) {
                this.speed = this.originalSpeed;
            }
        }
    }
    
    /**
     * 根据移动方向更新贴图朝向
     * 只翻转怪物贴图的Sprite组件，不翻转节点本身
     */
    private updateSpriteDirection(dirX: number) {
        if (!this.bodySprite) return;
        
        // 判断方向变化
        const newDirection = dirX < -0.1 ? -1 : (dirX > 0.1 ? 1 : this.lastDirection);
        
        if (newDirection !== this.lastDirection) {
            this.lastDirection = newDirection;
            
            // 只翻转bodySprite节点（保持缩放比例）
            if (this.bodySprite.node) {
                const scale = this.bodySprite.node.getScale();
                const absX = Math.abs(scale.x);
                this.bodySprite.node.setScale(v3(absX * newDirection, scale.y, scale.z));
                
                // 翻转后重新确保血条UI大小正确
                this.ensureHealthBarAfterFlip(newDirection);
            }
        }
    }
    
    /**
     * 翻转后确保血条UI保持正常显示
     */
    private ensureHealthBarAfterFlip(direction: number) {
        const inverseScale = 1 / this.baseScale;
        const flipFactor = direction;  // 1 或 -1
        
        // 血条父节点需要同时反向缩放和反向翻转
        if (this.hpFillBar && this.hpFillBar.parent) {
            const hpParent = this.hpFillBar.parent;
            if (this.isChildOf(hpParent, this.bodySprite?.node)) {
                // 反向缩放 + 反向翻转，保持血条正常显示
                hpParent.setScale(v3(inverseScale * flipFactor, inverseScale, 1));
            }
        }
        
        // 血量文字同样处理
        if (this.hpLabel && this.hpLabel.node) {
            const labelNode = this.hpLabel.node;
            if (this.isChildOf(labelNode, this.bodySprite?.node)) {
                // 如果文字和血条不在同一个父节点
                if (labelNode.parent !== this.hpFillBar?.parent) {
                    labelNode.setScale(v3(inverseScale * flipFactor, inverseScale, 1));
                }
            }
        }
    }
}
