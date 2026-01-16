import { _decorator, Component, Prefab, instantiate, find, Node, Label } from 'cc';
import { TileSlot, TileType } from './TileSlot';
import { Enemy, EnemyType } from './Enemy'; 
import { TouchManager } from './TouchManager';
import { GameConfig } from './GameConfig';
import { WaveSystem } from './WaveSystem';

const { ccclass, property } = _decorator;

/**
 * 旧的敌人生成器
 * 已被WaveSystem替代
 * 如果检测到WaveSystem存在，会自动禁用
 */
@ccclass('EnemySpawner')
export class EnemySpawner extends Component {
    @property(Prefab) public enemyPrefab: Prefab = null!;
    @property(Label) public waveLabel: Label = null!;

    private currentWave: number = 1;
    private enemiesLeftToSpawn: number = GameConfig.INITIAL_WAVE_ENEMY_COUNT; 
    private spawnTimer: number = 0;
    private waveGapTimer: number = 0; 
    private canvas: Node | null = null;
    private gridMap: Node | null = null;

    start() {
        // 检查是否有WaveSystem，如果有则禁用自己
        const canvas = find("Canvas");
        if (canvas) {
            const waveSystem = canvas.getComponent(WaveSystem) || canvas.getComponentInChildren(WaveSystem);
            if (waveSystem) {
                console.log("检测到WaveSystem，禁用旧的EnemySpawner");
                this.enabled = false;  // 禁用组件
                return;
            }
        }
        
        // 缓存节点引用，避免频繁查找
        this.canvas = find("Canvas");
        this.gridMap = find("Canvas/GridMap");
    }

    update(dt: number) {
        // 如果组件被禁用，不执行任何逻辑
        if (!this.enabled) return;
        
        if (TouchManager.isGameOver) return;

        // 等待所有敌人被消灭
        if (!this.canvas) {
            this.canvas = find("Canvas");
        }
        const aliveEnemies = this.canvas?.children.filter(n => n.name === "Enemy") || [];
        
        if (this.enemiesLeftToSpawn > 0) {
            // 生成敌人
            this.spawnTimer += dt;
            if (this.spawnTimer >= GameConfig.ENEMY_SPAWN_INTERVAL) {
                this.spawnEnemyByWave();
                this.enemiesLeftToSpawn--;
                this.spawnTimer = 0;
            }
        } else if (aliveEnemies.length === 0) {
            // 所有敌人被消灭，等待间隔后开始下一波
            this.waveGapTimer += dt;
            if (this.waveGapTimer >= GameConfig.WAVE_GAP_TIME) {
                this.currentWave++;
                this.enemiesLeftToSpawn = GameConfig.INITIAL_WAVE_ENEMY_COUNT + (this.currentWave - 1) * GameConfig.ENEMY_COUNT_PER_WAVE;
                this.waveGapTimer = 0;
                
                if (this.waveLabel) {
                    this.waveLabel.string = `WAVE: ${this.currentWave}`;
                }
            }
        }
    }

    spawnEnemyByWave() {
        if (!this.gridMap) {
            this.gridMap = find("Canvas/GridMap");
        }
        if (!this.gridMap) return;
        
        let startTile = this.gridMap.children.find(n => {
            const slot = n.getComponent(TileSlot);
            return slot && slot.type === TileType.START;
        });
        
        if (!startTile) return;
        
        let enemyNode = instantiate(this.enemyPrefab);
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
        const script = enemyNode.getComponent(Enemy);
        if (script) {
            // 根据波次决定敌人类型：前几波普通，之后随机
            let enemyType = EnemyType.NORMAL;
            if (this.currentWave > GameConfig.ENEMY_TYPE_RANDOM_START_WAVE) {
                const rand = Math.random();
                if (rand < GameConfig.FAST_ENEMY_SPAWN_CHANCE) enemyType = EnemyType.FAST;
                else if (rand < GameConfig.TANK_ENEMY_SPAWN_CHANCE) enemyType = EnemyType.TANK;
            }
            script.init(this.currentWave, enemyType);
        }
    }
}
