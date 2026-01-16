import { _decorator, Component, Prefab, instantiate, Node, v3, resources, JsonAsset } from 'cc';
import { TileSlot, TileType } from './TileSlot';
import { LevelData, LevelConfig } from './LevelData';

const { ccclass, property } = _decorator;

/**
 * 关卡加载器
 * 负责从配置文件加载关卡并生成地图
 */
@ccclass('LevelLoader')
export class LevelLoader extends Component {
    @property(Prefab) public tilePrefab: Prefab = null!;
    @property public gridSize: number = 75;
    @property public levelConfigPath: string = "levels/level1"; // resources下的路径

    private currentLevelData: LevelData | null = null;

    /**
     * 从JSON文件加载关卡
     */
    async loadLevelFromJson(path: string): Promise<LevelData | null> {
        return new Promise((resolve, reject) => {
            resources.load(path, JsonAsset, (err, jsonAsset) => {
                if (err) {
                    console.warn(`无法加载关卡配置 ${path}，使用默认关卡`, err);
                    resolve(LevelConfig.DEFAULT_LEVEL);
                    return;
                }
                
                try {
                    const data = jsonAsset.json as LevelData;
                    resolve(data);
                } catch (e) {
                    console.error(`解析关卡配置失败: ${path}`, e);
                    resolve(LevelConfig.DEFAULT_LEVEL);
                }
            });
        });
    }

    /**
     * 使用关卡数据生成地图
     */
    async generateLevel(levelData?: LevelData) {
        // 如果没有提供关卡数据，尝试从配置文件加载
        if (!levelData) {
            levelData = await this.loadLevelFromJson(this.levelConfigPath);
        }

        if (!levelData) {
            console.error("无法加载关卡数据，使用默认关卡");
            levelData = LevelConfig.DEFAULT_LEVEL;
        }

        this.currentLevelData = levelData;
        
        // 清空现有地图
        this.node.removeAllChildren();
        
        const layout = levelData.layout;
        const rows = layout.length;
        const cols = layout[0]?.length || 10;

        // 根据布局生成地图
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const tileTypeNum = layout[r]?.[c] ?? 2; // 默认为EMPTY
                const tileType = LevelConfig.numberToTileType(tileTypeNum);
                
                // 创建格子
                const tile = instantiate(this.tilePrefab);
                this.node.addChild(tile);
                
                // 设置位置
                const posX = (c - (cols - 1) / 2) * this.gridSize;
                const posY = ((rows - 1) / 2 - r) * this.gridSize;
                tile.setPosition(v3(posX, posY, 0));
                
                // 设置格子类型
                const tileSlot = tile.getComponent(TileSlot);
                if (tileSlot) {
                    tileSlot.type = tileType;
                    // 立即更新视觉效果（因为start可能还没执行）
                    tileSlot.updateVisual();
                }
                
                tile.name = `Tile_${r}_${c}`;
            }
        }

        console.log(`关卡 "${levelData.name}" 生成完成`);
        return levelData;
    }

    /**
     * 获取当前关卡数据
     */
    getCurrentLevelData(): LevelData | null {
        return this.currentLevelData;
    }
}
