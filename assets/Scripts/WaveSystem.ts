import { _decorator, Component, Prefab, instantiate, find, Node, Label, Color } from 'cc';
import { TileSlot, TileType } from './TileSlot';
import { Enemy, EnemyType } from './Enemy'; 
import { TouchManager } from './TouchManager';
import { ShopSystem } from './ShopSystem';
import { GameConfig } from './GameConfig';

const { ccclass, property } = _decorator;

/**
 * 波次配置
 */
interface WaveConfig {
    waveNumber: number;
    enemyCount: number;
    enemyType: EnemyType;  // 改为单一类型，确保同一波次属性一致
    spawnInterval: number;  // 生成间隔
    isElite?: boolean;      // 是否为精英波
    isBoss?: boolean;        // 是否为Boss波
}

/**
 * 波次系统
 * 管理30波敌人，包含精英怪和Boss
 * 支持备战阶段和倒计时显示
 * 重要：每波次只出一种类型的敌人，确保属性一致
 */
@ccclass('WaveSystem')
export class WaveSystem extends Component {
    @property(Prefab) public enemyPrefab: Prefab = null!;
    @property(Prefab) public eliteEnemyPrefab: Prefab = null!;  // 精英怪预制体（可选）
    @property(Prefab) public bossEnemyPrefab: Prefab = null!;   // Boss预制体（可选）
    @property(Label) public waveLabel: Label = null!;
    @property(Label) public countdownLabel: Label = null!;  // 倒计时标签

    private readonly TOTAL_WAVES = 30;
    private readonly ELITE_WAVES = [15, 25];
    private readonly BOSS_WAVE = 30;
    
    private currentWave: number = 0;  // 0表示备战阶段
    private waveConfigs: WaveConfig[] = [];
    private enemiesLeftToSpawn: number = 0;
    private spawnTimer: number = 0;
    private waveGapTimer: number = 0;
    private prepareTimer: number = GameConfig.PREPARE_TIME;  // 备战阶段倒计时
    private isPreparing: boolean = true;  // 是否在备战阶段
    private waveElapsedTime: number = 0;  // 当前波次已进行时间
    private waveTotalDuration: number = 0;  // 当前波次预计总时长
    private canvas: Node | null = null;
    private gridMap: Node | null = null;
    private shopSystem: ShopSystem | null = null;
    private enemySpawnCounter: number = 0;  // 敌人生成计数器（用于层级）

    start() {
        console.log("=== WaveSystem start() 被调用 ===");
        
        this.canvas = find("Canvas");
        this.gridMap = find("Canvas/GridMap");
        this.shopSystem = find("Canvas")?.getComponentInChildren(ShopSystem) || null;
        
        // 检查enemyPrefab是否设置
        if (!this.enemyPrefab) {
            console.error("WaveSystem: enemyPrefab未设置！请在编辑器中将敌人预制体拖到WaveSystem组件的Enemy Prefab属性中");
        } else {
            console.log("WaveSystem: enemyPrefab已设置");
        }
        
        // 禁用旧的EnemySpawner（如果存在）
        const enemySpawner = this.canvas?.getComponent("EnemySpawner");
        if (enemySpawner) {
            console.log("禁用旧的EnemySpawner组件");
            (enemySpawner as any).enabled = false;
        }
        
        // 初始化所有波次配置
        this.initWaveConfigs();
        
        // 延迟查找倒计时标签（确保UIBuilder已创建）
        this.scheduleOnce(() => {
            this.tryFindCountdownLabel();
        }, 0.3);
        
        // 开始备战阶段
        this.startPreparePhase();
        
        console.log("=== WaveSystem 初始化完成 ===");
    }
    
    /**
     * 尝试查找并连接倒计时标签
     */
    private tryFindCountdownLabel() {
        if (this.countdownLabel) {
            return;  // 已经连接，不需要再查找
        }
        
        const topBar = find("Canvas/TopBar");
        if (topBar) {
            // 新结构：CountdownLabel在CenterArea下
            const centerArea = topBar.getChildByName("CenterArea");
            const countdownNode = centerArea?.getChildByName("CountdownLabel") || topBar.getChildByName("CountdownLabel");
            if (countdownNode) {
                const countdownLabel = countdownNode.getComponent(Label);
                if (countdownLabel) {
                    this.countdownLabel = countdownLabel;
                    console.log("WaveSystem: 倒计时标签已连接");
                }
            }
        }
    }

    /**
     * 开始备战阶段
     */
    private startPreparePhase() {
        console.log("开始备战阶段，倒计时15秒");
        this.isPreparing = true;
        this.prepareTimer = GameConfig.PREPARE_TIME;
        this.currentWave = 0;
        
        // 更新UI（通过UIController或直接更新TopBar）
        this.updateWaveLabel();
        
        if (this.countdownLabel) {
            this.countdownLabel.string = `准备时间: ${Math.ceil(this.prepareTimer)}秒`;
        }
    }
    
    /**
     * 完全重置波次系统（重新挑战时调用）
     */
    public resetWaveSystem() {
        console.log("完全重置WaveSystem...");
        
        // 重置所有状态
        this.currentWave = 0;
        this.isPreparing = true;
        this.prepareTimer = GameConfig.PREPARE_TIME;
        this.enemiesLeftToSpawn = 0;
        this.spawnTimer = 0;
        this.waveGapTimer = 0;
        this.waveElapsedTime = 0;
        this.waveTotalDuration = 0;
        
        // 重新初始化波次配置
        this.initWaveConfigs();
        
        // 开始备战阶段
        this.startPreparePhase();
        
        console.log("WaveSystem已完全重置，从备战阶段开始");
    }

    /**
     * 更新波次标签
     */
    private updateWaveLabel() {
        // 简化显示格式：X/30
        const waveText = this.currentWave > 0 ? `${this.currentWave}/30` : "准备";
        
        // 更新UIBuilder创建的Label（路径：TopBar/RightArea/WaveBg/WaveLabel）
        const topBar = find("Canvas/TopBar");
        if (topBar) {
            let waveLabel: Label | null = null;
            
            // 正确路径：TopBar -> RightArea -> WaveBg -> WaveLabel
            const rightArea = topBar.getChildByName("RightArea");
            if (rightArea) {
                const waveBg = rightArea.getChildByName("WaveBg");
                if (waveBg) {
                    waveLabel = waveBg.getChildByName("WaveLabel")?.getComponent(Label) || null;
                }
            }
            
            // 备用：直接在TopBar下递归查找
            if (!waveLabel) {
                const findLabel = (node: Node): Label | null => {
                    if (node.name === "WaveLabel") {
                        return node.getComponent(Label);
                    }
                    for (const child of node.children) {
                        const found = findLabel(child);
                        if (found) return found;
                    }
                    return null;
                };
                waveLabel = findLabel(topBar);
            }
            
            if (waveLabel) {
                waveLabel.string = waveText;
            }
        }
        
        // 也更新直接绑定的Label（如果存在）
        if (this.waveLabel) {
            this.waveLabel.string = waveText;
        }
    }

    /**
     * 初始化所有波次配置
     * 重要：每波次只配置一种敌人类型，确保属性一致
     * 
     * 设计理念：
     * - 每波固定25个怪物，保持玩家注意力
     * - 难度通过怪物属性（血量、速度）递增，而不是数量
     * - 精英波和Boss波有特殊配置
     */
    private initWaveConfigs() {
        // 清空旧配置
        this.waveConfigs = [];
        
        for (let wave = 1; wave <= this.TOTAL_WAVES; wave++) {
            const isElite = this.ELITE_WAVES.includes(wave);
            const isBoss = wave === this.BOSS_WAVE;
            
            let enemyCount: number;
            let spawnInterval: number;
            let enemyType: EnemyType;

            if (isBoss) {
                // Boss波：1个Boss
                enemyCount = 1;
                spawnInterval = 0;
                enemyType = EnemyType.BOSS;
            } else if (isElite) {
                // 精英波：8个精英怪
                enemyCount = 8;
                spawnInterval = 1.0;
                enemyType = EnemyType.ELITE;
            } else {
                // 普通波：固定数量，便于玩家学习
                enemyCount = this.getEnemyCountForWave(wave);
                spawnInterval = GameConfig.ENEMY_SPAWN_INTERVAL;
                
                // 获取该波次的敌人类型
                enemyType = this.getEnemyTypeForWave(wave);
            }

            this.waveConfigs.push({
                waveNumber: wave,
                enemyCount,
                enemyType,
                spawnInterval,
                isElite,
                isBoss
            });
        }
        
        // 打印配置信息用于调试
        console.log("波次配置初始化完成，共30波");
        for (let i = 0; i < Math.min(5, this.waveConfigs.length); i++) {
            const config = this.waveConfigs[i];
            const typeName = this.getEnemyTypeName(config.enemyType);
            console.log(`第${config.waveNumber}波: ${config.enemyCount}个${typeName}敌人, 间隔${config.spawnInterval.toFixed(2)}秒`);
        }
    }
    
    /**
     * 获取敌人类型名称
     */
    private getEnemyTypeName(type: EnemyType): string {
        switch (type) {
            case EnemyType.NORMAL: return "普通";
            case EnemyType.FAST: return "快速";
            case EnemyType.TANK: return "坦克";
            case EnemyType.ELITE: return "精英";
            case EnemyType.BOSS: return "Boss";
            default: return "未知";
        }
    }

    /**
     * 根据波次获取固定的怪物数量（30-45之间）
     * 固定数量便于玩家学习和制定策略
     */
    private getEnemyCountForWave(wave: number): number {
        // 波次 -> 怪物数量 映射表（30-45之间变化）
        const waveCountMap: { [key: number]: number } = {
            1: 30,   // 新手期，较少
            2: 30,
            3: 32,
            4: 35,   // 快速怪，稍多
            5: 35,
            6: 32,   // 喘息
            7: 32,
            8: 38,   // 坦克怪，需要更多时间击杀
            9: 38,
            10: 36,  // 快速怪
            11: 34,
            12: 34,
            13: 40,  // 坦克怪
            14: 40,
            // 15波是精英波
            16: 38,
            17: 35,
            18: 35,
            19: 42,  // 高压期开始
            20: 40,
            21: 40,
            22: 42,
            23: 44,
            24: 45,  // 最高压
            // 25波是精英波
            26: 42,
            27: 44,
            28: 45,
            29: 35,  // Boss前喘息
            // 30波是Boss波
        };
        
        return waveCountMap[wave] || 35;
    }

    /**
     * 根据波次获取敌人类型（每波只返回一种类型）
     * 重要：同一波次内所有敌人类型和属性完全一致！
     * 不同波次之间可以更换怪物类型。
     */
    private getEnemyTypeForWave(wave: number): EnemyType {
        // 波次 -> 怪物类型 映射表
        const waveTypeMap: { [key: number]: EnemyType } = {
            1: EnemyType.NORMAL,
            2: EnemyType.NORMAL,
            3: EnemyType.NORMAL,
            4: EnemyType.FAST,
            5: EnemyType.FAST,
            6: EnemyType.NORMAL,
            7: EnemyType.NORMAL,
            8: EnemyType.TANK,
            9: EnemyType.TANK,
            10: EnemyType.FAST,
            11: EnemyType.NORMAL,
            12: EnemyType.NORMAL,
            13: EnemyType.TANK,
            14: EnemyType.TANK,
            // 15波是精英波，在initWaveConfigs中单独处理
            16: EnemyType.FAST,
            17: EnemyType.NORMAL,
            18: EnemyType.NORMAL,
            19: EnemyType.TANK,
            20: EnemyType.FAST,
            21: EnemyType.FAST,
            22: EnemyType.TANK,
            23: EnemyType.TANK,
            24: EnemyType.TANK,
            // 25波是精英波，在initWaveConfigs中单独处理
            26: EnemyType.FAST,
            27: EnemyType.TANK,
            28: EnemyType.TANK,
            29: EnemyType.NORMAL,
            // 30波是Boss波，在initWaveConfigs中单独处理
        };
        
        return waveTypeMap[wave] || EnemyType.NORMAL;
    }

    /**
     * 开始新波次
     */
    startWave(waveNumber: number) {
        if (waveNumber > this.TOTAL_WAVES) {
            console.log("恭喜！所有波次完成！");
            return;
        }

        this.currentWave = waveNumber;
        this.isPreparing = false;
        const config = this.waveConfigs[waveNumber - 1];
        
        if (!config) {
            console.error(`波次配置不存在: ${waveNumber}`);
            return;
        }

        // 打印波次信息用于调试
        const typeName = config.enemyType === EnemyType.NORMAL ? "普通" : 
                        config.enemyType === EnemyType.FAST ? "快速" : "坦克";
        console.log(`=== 开始第${waveNumber}波: ${config.enemyCount}个${typeName}敌人 ===`);

        this.enemiesLeftToSpawn = config.enemyCount;
        this.spawnTimer = 0;
        this.waveGapTimer = 0;
        this.waveElapsedTime = 0;
        this.enemySpawnCounter = 0;  // 重置敌人生成计数器
        
        // 设置波次固定时长（保证倒计时一直显示）
        // 普通波 25秒，精英波 35秒，Boss波 45秒
        if (config.isBoss) {
            this.waveTotalDuration = 45;
        } else if (config.isElite) {
            this.waveTotalDuration = 35;
        } else {
            this.waveTotalDuration = 25;
        }

        // 立即更新UI
        this.updateWaveLabel();
        
        // 延迟再次更新，确保UI刷新
        this.scheduleOnce(() => {
            this.updateWaveLabel();
        }, 0.1);

        // 通知商店系统刷新（如果存在）
        if (this.shopSystem) {
            (this.shopSystem as any).refreshShop();
        }
    }

    update(dt: number) {
        if (TouchManager.isGameOver) return;

        // 如果倒计时标签还没有连接，尝试查找（最多尝试前10帧）
        if (!this.countdownLabel && this.node.frameCount < 10) {
            this.tryFindCountdownLabel();
        }

        // 备战阶段
        if (this.isPreparing) {
            this.prepareTimer -= dt;
            
            // 每帧更新波次标签（备战阶段）
            this.updateWaveLabel();
            
            // 更新备战阶段倒计时显示
            if (this.countdownLabel && this.countdownLabel.isValid) {
                const remaining = Math.ceil(Math.max(0, this.prepareTimer));
                this.countdownLabel.string = `⏳ 准备时间: ${remaining}秒`;
                this.countdownLabel.color = new Color(255, 200, 100, 255);
            }
            
            if (this.prepareTimer <= 0) {
                // 备战结束，开始第一波
                console.log("备战阶段结束，开始第1波");
                this.startWave(1);
            }
            return;
        }
        
        // 每帧更新波次标签（确保显示正确）
        this.updateWaveLabel();

        const config = this.waveConfigs[this.currentWave - 1];
        if (!config) {
            console.warn(`当前波次配置不存在: currentWave=${this.currentWave}, waveConfigs.length=${this.waveConfigs.length}`);
            return;
        }

        // 更新波次已进行时间
        this.waveElapsedTime += dt;
        
        if (this.enemiesLeftToSpawn > 0) {
            // 生成敌人阶段
            this.spawnTimer += dt;
            if (this.spawnTimer >= config.spawnInterval) {
                if (!this.enemyPrefab) {
                    console.error("无法生成敌人：enemyPrefab未设置！");
                } else {
                    this.spawnEnemy(config);
                    console.log(`生成敌人: 第${this.currentWave}波，剩余: ${this.enemiesLeftToSpawn - 1}/${config.enemyCount}`);
                }
                this.enemiesLeftToSpawn--;
                this.spawnTimer = 0;
            }
            
            // 生成阶段，重置倒计时
            this.waveGapTimer = 0;
            // 隐藏倒计时
            if (this.countdownLabel && this.countdownLabel.isValid) {
                this.countdownLabel.string = "";
            }
        } else {
            // 所有敌人都已生成，等待所有敌人被消灭
            if (!this.canvas) {
                this.canvas = find("Canvas");
            }
            
            // 递归查找所有敌人（包括子节点中的）
            const findAllEnemies = (node: Node): Node[] => {
                const enemies: Node[] = [];
                if (node.name === "Enemy" && node.isValid) {
                    enemies.push(node);
                }
                node.children.forEach(child => {
                    enemies.push(...findAllEnemies(child));
                });
                return enemies;
            };
            
            const aliveEnemies = this.canvas ? findAllEnemies(this.canvas) : [];
            
            if (aliveEnemies.length === 0) {
                // 所有敌人被消灭，开始倒计时
                const gapTime = config.isBoss ? 6.0 : (config.isElite ? 5.0 : 4.0);
                
                // 如果waveGapTimer为0，说明刚进入这个状态，初始化计时器
                if (this.waveGapTimer === 0) {
                    console.log(`[第${this.currentWave}波] 所有敌人被消灭，开始倒计时 ${gapTime}秒`);
                    this.waveGapTimer = dt;  // 从当前帧开始计时
                } else {
                    this.waveGapTimer += dt;
                }
                
                // 显示倒计时
                const remaining = gapTime - this.waveGapTimer;
                if (this.countdownLabel && this.countdownLabel.isValid) {
                    if (remaining > 0) {
                        this.countdownLabel.string = `下一波: ${Math.ceil(remaining)}秒`;
                    } else {
                        this.countdownLabel.string = "";
                    }
                } else {
                    // 尝试直接查找并更新
                    const topBar = find("Canvas/TopBar");
                    if (topBar) {
                        const countdownNode = topBar.getChildByName("CountdownLabel");
                        if (countdownNode) {
                            const countdownLabel = countdownNode.getComponent(Label);
                            if (countdownLabel && remaining > 0) {
                                countdownLabel.string = `下一波: ${Math.ceil(remaining)}秒`;
                            }
                        }
                    }
                }
                
                // 倒计时结束，开始下一波
                if (this.waveGapTimer >= gapTime) {
                    const nextWave = this.currentWave + 1;
                    console.log(`[第${this.currentWave}波] 倒计时结束，开始第${nextWave}波`);
                    this.startWave(nextWave);
                    return;  // 重要：立即返回，避免继续执行后面的代码
                }
            } else {
                // 还有敌人存活，重置倒计时
                if (this.waveGapTimer > 0) {
                    console.log(`[第${this.currentWave}波] 还有${aliveEnemies.length}个敌人存活，重置倒计时`);
                }
                this.waveGapTimer = 0;
                // 隐藏倒计时
                if (this.countdownLabel && this.countdownLabel.isValid) {
                    this.countdownLabel.string = "";
                }
            }
        }
    }

    /**
     * 生成敌人
     * 重要：同一波次的所有敌人使用相同的wave和type，确保属性一致
     */
    private spawnEnemy(config: WaveConfig) {
        if (!this.enemyPrefab) {
            console.error("spawnEnemy: enemyPrefab未设置");
            return;
        }
        
        if (!this.gridMap) {
            this.gridMap = find("Canvas/GridMap");
        }
        if (!this.gridMap) {
            console.warn("spawnEnemy: GridMap未找到");
            return;
        }

        let startTile = this.gridMap.children.find(n => {
            const slot = n.getComponent(TileSlot);
            return slot && slot.type === TileType.START;
        });

        if (!startTile) {
            console.warn("spawnEnemy: 未找到START类型的格子");
            return;
        }

        // 使用配置中的单一敌人类型（不再随机选择）
        const enemyType = config.enemyType;
        
        // 选择预制体
        let prefab = this.enemyPrefab;
        if (config.isBoss && this.bossEnemyPrefab) {
            prefab = this.bossEnemyPrefab;
        } else if (config.isElite && this.eliteEnemyPrefab) {
            prefab = this.eliteEnemyPrefab;
        }

        let enemyNode = instantiate(prefab);
        if (!this.canvas) {
            this.canvas = find("Canvas");
        }
        if (!this.canvas) {
            enemyNode.destroy();
            return;
        }

        this.canvas.addChild(enemyNode);
        enemyNode.name = "Enemy";
        enemyNode.setPosition(startTile.getPosition());

        // 初始化敌人属性
        // 重要：使用this.currentWave和config.enemyType，确保同一波次所有敌人属性一致
        const script = enemyNode.getComponent(Enemy);
        if (script) {
            // 使用this.currentWave和enemyType，确保同一波次属性一致
            script.init(this.currentWave, enemyType);
            
            // 设置生成顺序（用于层级，先生成的显示在前面）
            this.enemySpawnCounter++;
            script.setSpawnOrder(this.enemySpawnCounter);
            
            // 调试日志：打印生成的敌人信息
            const typeName = this.getEnemyTypeName(enemyType);
            console.log(`生成敌人: ${typeName}, 波次: ${this.currentWave}, 血量: ${script.maxHp}, 速度: ${script.speed}`);
        } else {
            console.error("spawnEnemy: Enemy组件未找到");
        }
    }

    /**
     * 获取当前波次
     */
    getCurrentWave(): number {
        return this.currentWave;
    }

    /**
     * 是否在备战阶段
     */
    isInPreparePhase(): boolean {
        return this.isPreparing;
    }
    
    /**
     * 获取备战阶段剩余时间
     */
    getPrepareTimeRemaining(): number {
        return this.isPreparing ? Math.max(0, this.prepareTimer) : 0;
    }
    
    /**
     * 获取距离下一波的剩余时间
     * 在整个波次进行过程中都显示
     */
    getNextWaveRemaining(): number {
        if (this.isPreparing) return 0;
        if (this.currentWave <= 0) return 0;
        if (this.currentWave >= this.waveConfigs.length) return 0;  // 最后一波不显示
        
        const config = this.waveConfigs[this.currentWave - 1];
        const gapTime = config?.isBoss ? 6.0 : (config?.isElite ? 5.0 : 4.0);
        
        // 如果已经在倒计时阶段（敌人全部消灭），使用精确倒计时
        if (this.waveGapTimer > 0) {
            return Math.max(0, gapTime - this.waveGapTimer);
        }
        
        // 否则显示距离下一波的预估时间
        const remaining = this.waveTotalDuration - this.waveElapsedTime;
        // 如果预估时间用完但敌人还没消灭，至少显示波间倒计时
        if (remaining <= 0) {
            return gapTime;  // 显示波间时间作为最小值
        }
        return remaining;
    }
    
    /**
     * 获取下一波倒计时剩余时间（仅在敌人全部消灭后）
     */
    getWaveGapRemaining(): number {
        if (this.waveGapTimer <= 0) return 0;
        
        const config = this.waveConfigs[this.currentWave - 1];
        if (!config) return 0;
        
        const gapTime = config.isBoss ? 6.0 : (config.isElite ? 5.0 : 4.0);
        return Math.max(0, gapTime - this.waveGapTimer);
    }
    
    /**
     * 是否正在战斗（有敌人且不在备战阶段）
     */
    isInCombat(): boolean {
        if (this.isPreparing) return false;
        if (this.waveGapTimer > 0) return false;
        return this.currentWave > 0;
    }
}
