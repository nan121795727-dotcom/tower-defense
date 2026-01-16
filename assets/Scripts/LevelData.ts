import { TileType } from './TileSlot';

/**
 * 关卡数据接口
 * 定义关卡配置的数据结构
 */
export interface LevelData {
    /** 关卡ID */
    id: number;
    /** 关卡名称 */
    name: string;
    /** 地图布局：二维数组，每个元素代表一个格子的类型
     * 0 = VOID (不可放置)
     * 1 = PATH (路径)
     * 2 = EMPTY (可放置塔的空地)
     * 3 = START (起点)
     * 4 = END (终点)
     */
    layout: number[][];
    /** 初始金币 */
    initialMoney?: number;
    /** 初始生命值 */
    initialHealth?: number;
}

/**
 * 关卡配置管理器
 * 管理所有关卡配置数据
 */
export class LevelConfig {
    /** 默认关卡配置 */
    static readonly DEFAULT_LEVEL: LevelData = {
        id: 1,
        name: "默认关卡",
        layout: [
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        ]
    };

    /**
     * 将数字转换为TileType
     */
    static numberToTileType(num: number): TileType {
        switch (num) {
            case 0: return TileType.VOID;
            case 1: return TileType.PATH;
            case 2: return TileType.EMPTY;
            case 3: return TileType.START;
            case 4: return TileType.END;
            default: return TileType.EMPTY;
        }
    }
}
