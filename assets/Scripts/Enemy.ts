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

    /**
     * 初始化敌人
     * @param wave 当前波次（用于计算血量和奖励增长）
     * @param type 敌人类型
     * 
     * 设计理念：同一种怪物在不同波次血量和奖励都会增长
     * 血量公式：基础血量 + (波次-1) × 每波增长
     * 奖励公式：基础奖励 + floor((波次-1) / 5) × 奖励增长
     */
    public init(wave: number, type: EnemyType = EnemyType.NORMAL) {
        this.enemyType = type;
        const waveBonus = Math.max(0, wave - 1);  // 波次加成（从第2波开始增长）
        const rewardTier = Math.floor(waveBonus / 5);  // 每5波奖励提升一档
        
        // 根据怪物类型设置属性（血量和奖励随波次增长）
        switch (type) {
            case EnemyType.FAST:
                // 快速怪物（蝙蝠）：血少、速度快
                this.maxHp = GameConfig.FAST_ENEMY_BASE_HP + waveBonus * GameConfig.FAST_ENEMY_HP_PER_WAVE;
                this.speed = GameConfig.FAST_ENEMY_SPEED;
                this.killReward = GameConfig.FAST_ENEMY_BASE_REWARD + rewardTier * GameConfig.FAST_ENEMY_REWARD_PER_5WAVE;
                this.setScale(0.7);
                break;
                
            case EnemyType.TANK:
                // 坦克怪物（哥布林）：血厚、速度慢
                this.maxHp = GameConfig.TANK_ENEMY_BASE_HP + waveBonus * GameConfig.TANK_ENEMY_HP_PER_WAVE;
                this.speed = GameConfig.TANK_ENEMY_SPEED;
                this.killReward = GameConfig.TANK_ENEMY_BASE_REWARD + rewardTier * GameConfig.TANK_ENEMY_REWARD_PER_5WAVE;
                this.setScale(1.3);
                break;
                
            case EnemyType.ELITE:
                // 精英怪物（骷髅战士）：血多、速度中等
                this.maxHp = GameConfig.ELITE_ENEMY_BASE_HP + waveBonus * GameConfig.ELITE_ENEMY_HP_PER_WAVE;
                this.speed = GameConfig.ELITE_ENEMY_SPEED;
                this.killReward = GameConfig.ELITE_ENEMY_BASE_REWARD + rewardTier * GameConfig.ELITE_ENEMY_REWARD_PER_5WAVE;
                this.setScale(1.2);
                break;
                
            case EnemyType.BOSS:
                // Boss怪物：固定血量，不给钱
                this.maxHp = GameConfig.BOSS_ENEMY_HP;
                this.speed = GameConfig.BOSS_ENEMY_SPEED;
                this.killReward = GameConfig.BOSS_ENEMY_REWARD;
                this.setScale(1.8);
                break;
                
            default:
                // 普通怪物（史莱姆）
                this.maxHp = GameConfig.NORMAL_ENEMY_BASE_HP + waveBonus * GameConfig.NORMAL_ENEMY_HP_PER_WAVE;
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
        if (this.hp <= 0 && this.node && this.node.isValid) {
            // 使用计算好的击杀奖励
            TouchManager.money += this.killReward;
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
     * 根据Y坐标更新层级
     * Y值越小（越靠近屏幕底部），层级越高（显示在上面）
     * 这样下方的怪物/防御塔会遮挡上方的
     */
    private updateZIndexByY() {
        if (!this.node || !this.node.parent) return;
        
        // Y坐标范围约 -400 到 400
        // 映射到层级 20-199（低于商店面板500，低于防御塔拖拽9999）
        // Y=-400（最下方）→ 层级199（最高）
        // Y=400（最上方）→ 层级20（最低）
        const yPos = this.node.position.y;
        const zIndex = Math.floor(199 - (yPos + 400) * 179 / 800);
        const clampedIndex = Math.max(20, Math.min(199, zIndex));
        
        this.node.setSiblingIndex(clampedIndex);
    }
    
    /**
     * 设置生成顺序（由WaveSystem调用）
     * 现在不再用于层级，层级完全由Y坐标决定
     */
    public setSpawnOrder(order: number) {
        // 层级现在由 updateZIndexByY 在每帧更新
        // 这个方法保留以兼容现有调用
    }

    /**
     * 应用减速效果
     */
    public applySlow(slowPercent: number, duration: number) {
        this.speed = Math.floor(this.originalSpeed * (1 - slowPercent));
        this.scheduleOnce(() => {
            if (this.node && this.node.isValid) {
                this.speed = this.originalSpeed;
            }
        }, duration);
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
