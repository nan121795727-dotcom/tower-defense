import { _decorator, Component, Node, find } from 'cc';
import { LevelLoader } from './LevelLoader';
import { LevelData } from './LevelData';
import { TouchManager } from './TouchManager';
import { GameConfig } from './GameConfig';

const { ccclass, property } = _decorator;

/**
 * 关卡管理器
 * 管理关卡切换、进度保存等
 */
@ccclass('LevelManager')
export class LevelManager extends Component {
    @property(Node) public gridMapNode: Node = null!;
    
    private currentLevelId: number = 1;
    private levelLoader: LevelLoader | null = null;

    start() {
        // 查找或创建LevelLoader
        if (this.gridMapNode) {
            this.levelLoader = this.gridMapNode.getComponent(LevelLoader);
            if (!this.levelLoader) {
                this.levelLoader = this.gridMapNode.addComponent(LevelLoader);
            }
        } else {
            // 尝试从场景中查找GridMap节点
            const gridMap = find("Canvas/GridMap");
            if (gridMap) {
                this.gridMapNode = gridMap;
                this.levelLoader = gridMap.getComponent(LevelLoader);
                if (!this.levelLoader) {
                    this.levelLoader = gridMap.addComponent(LevelLoader);
                }
            }
        }

        // 加载当前关卡
        this.loadLevel(this.currentLevelId);
    }

    /**
     * 加载指定关卡
     */
    async loadLevel(levelId: number) {
        if (!this.levelLoader) {
            console.error("LevelLoader未找到");
            return;
        }

        this.currentLevelId = levelId;
        const levelPath = `levels/level${levelId}`;
        this.levelLoader.levelConfigPath = levelPath;

        const levelData = await this.levelLoader.generateLevel();
        
        if (levelData) {
            // 应用关卡初始设置
            if (levelData.initialMoney !== undefined) {
                TouchManager.money = levelData.initialMoney;
            } else {
                TouchManager.money = GameConfig.INITIAL_MONEY;
            }

            if (levelData.initialHealth !== undefined) {
                TouchManager.baseHealth = levelData.initialHealth;
            } else {
                TouchManager.baseHealth = GameConfig.INITIAL_HEALTH;
            }

            TouchManager.isGameOver = false;
            console.log(`关卡 ${levelId} 加载完成: ${levelData.name}`);
        }
    }

    /**
     * 重新加载当前关卡
     */
    reloadCurrentLevel() {
        this.loadLevel(this.currentLevelId);
    }

    /**
     * 加载下一关
     */
    loadNextLevel() {
        this.loadLevel(this.currentLevelId + 1);
    }

    /**
     * 获取当前关卡ID
     */
    getCurrentLevelId(): number {
        return this.currentLevelId;
    }
}
