import { Enum, Color } from 'cc';
import { GameConfig } from './GameConfig';

/**
 * 防御塔品质
 */
export enum TowerRarity {
    WHITE = 0,   // 白色品质
    GREEN = 1,   // 绿色品质
    BLUE = 2     // 蓝色品质
}
Enum(TowerRarity);

/**
 * 防御塔类型（用于羁绊效果）
 */
export enum TowerCategory {
    PHYSICAL = 0,    // 物理型
    MAGIC = 1,       // 魔法型
    SUPPORT = 2,     // 辅助型
    AOE = 3          // 范围型
}
Enum(TowerCategory);

/**
 * 技能类型
 */
export enum SkillType {
    NONE = 0,           // 无技能（纯普攻）
    AOE_DAMAGE = 1,     // 范围伤害
    SLOW = 2,           // 减速
    BUFF_DAMAGE = 3,    // 增加友军伤害
    BUFF_SPEED = 4,     // 增加友军攻击速度
    CHAIN = 5,          // 连锁攻击
    SPLASH = 6          // 溅射伤害
}
Enum(SkillType);

/**
 * 防御塔数据配置
 */
export interface TowerData {
    id: string;                    // 防御塔ID
    name: string;                   // 防御塔名称
    rarity: TowerRarity;           // 品质
    category: TowerCategory;       // 类型
    baseCost: number;              // 基础价格
    baseDamage: number;            // 基础伤害（整数）
    baseAttackInterval: number;    // 基础攻击间隔
    baseRange: number;             // 基础攻击范围
    skillType: SkillType;          // 技能类型
    skillValue: number;            // 技能数值（伤害倍数、减速百分比等）
    skillCooldown?: number;         // 技能冷却时间（可选）
    description: string;            // 描述
    spriteTexture?: string;         // 贴图资源名称（不含后缀）
}

// 攻击范围常量（以地块为单位）
const TILE = GameConfig.TILE_SIZE;  // 一个地块的像素大小（80）

/**
 * 射程计算说明：
 * - 射程是从塔中心到目标的距离
 * - 1格射程 = 能打到相邻1格的怪物 = TILE * 1.5（半个自己格子 + 1个相邻格子）
 * - 2格射程 = 能打到相邻2格的怪物 = TILE * 2.5
 * - 3格射程 = 能打到相邻3格的怪物 = TILE * 3.5
 * 
 * 示意图（T=塔，数字=射程能覆盖的格子）：
 *   3 3 3 3 3
 *   3 2 2 2 3
 *   3 2 1 2 3
 *   3 2 T 2 3
 *   3 2 1 2 3
 *   3 2 2 2 3
 *   3 3 3 3 3
 */
const RANGE_1 = TILE * 1.5;  // 1格射程：覆盖相邻1格
const RANGE_2 = TILE * 2.5;  // 2格射程：覆盖相邻2格
const RANGE_3 = TILE * 3.5;  // 3格射程：覆盖相邻3格

/**
 * 防御塔配置数据
 * 
 * 设计理念：
 * - 射手：远程（3格）、快速攻击、低伤害 → 适合放在后排持续输出
 * - 法师：中程（2格）、中速攻击、中伤害 → 通用型
 * - 战士：近程（1格）、慢速攻击、高伤害 → 适合放在怪物必经之路
 * - 冰法：中程（2格）、快速攻击、低伤害+减速 → 控制型，配合其他塔
 * - 小炮：近程（1格）、慢速攻击、高伤害+溅射 → 群伤型，需要近距离
 * - 闪电塔：远程（3格）、中速攻击、中伤害+连锁 → 多目标输出
 */
/**
 * 防御塔价格设计（初始金币120）：
 * - 便宜塔(20-30金)：可买4-6个，数量优势但单体弱
 * - 中等塔(50-60金)：可买2个，平衡选择
 * - 贵塔(100-120金)：只能买1个，单体强但前期压力大
 * 
 * 策略选择示例：
 * A) 1个闪电塔(120金) = 0金剩余，等第一波收入
 * B) 1个冰法(60金) + 1个射手(25金) = 35金剩余
 * C) 4个射手(25×4=100金) = 20金剩余
 * D) 1个小炮(50金) + 存70金，第一波中途再买
 */
export class TowerConfig {
    static readonly TOWERS: TowerData[] = [
        // ========== 白色品质（3个）- 便宜但基础 ==========
        {
            id: "tower_archer",
            name: "射手",
            rarity: TowerRarity.WHITE,
            category: TowerCategory.PHYSICAL,
            baseCost: 25,           // 便宜！可以多买
            baseDamage: 6,          // 低伤害，DPS=10
            baseAttackInterval: 0.6, // 快速攻击
            baseRange: RANGE_3,      // 远程（3格）
            skillType: SkillType.NONE,
            skillValue: 0,
            description: "远程物理",
            spriteTexture: "tower_gj"
        },
        {
            id: "tower_mage",
            name: "法师",
            rarity: TowerRarity.WHITE,
            category: TowerCategory.MAGIC,
            baseCost: 30,           // 便宜
            baseDamage: 8,          // 中伤害，DPS=8
            baseAttackInterval: 1.0, // 中速攻击
            baseRange: RANGE_2,      // 中程（2格）
            skillType: SkillType.NONE,
            skillValue: 0,
            description: "远程魔法",
            spriteTexture: "tower_fs"
        },
        {
            id: "tower_guard",
            name: "战士",
            rarity: TowerRarity.WHITE,
            category: TowerCategory.PHYSICAL,
            baseCost: 35,           // 稍贵一点
            baseDamage: 15,         // 高伤害，DPS=10
            baseAttackInterval: 1.5, // 慢速攻击
            baseRange: RANGE_1,      // 近程（1格）
            skillType: SkillType.NONE,
            skillValue: 0,
            description: "高伤害",
            spriteTexture: "tower_sw"
        },
        
        // ========== 绿色品质（2个）- 中等价格有技能 ==========
        {
            id: "tower_cannon",
            name: "小炮",
            rarity: TowerRarity.GREEN,
            category: TowerCategory.AOE,
            baseCost: 50,           // 中等价格
            baseDamage: 18,         // 高伤害+溅射
            baseAttackInterval: 2.0, // 极慢攻击
            baseRange: RANGE_1,      // 近程（1格）
            skillType: SkillType.SPLASH,
            skillValue: 0.6,        // 溅射60%伤害
            skillCooldown: 0,
            description: "范围伤害",
            spriteTexture: "tower_hp"
        },
        {
            id: "tower_ice",
            name: "冰法",
            rarity: TowerRarity.GREEN,
            category: TowerCategory.SUPPORT,
            baseCost: 60,           // 中等价格
            baseDamage: 4,          // 低伤害但有减速
            baseAttackInterval: 0.5, // 极快攻击
            baseRange: RANGE_2,      // 中程（2格）
            skillType: SkillType.SLOW,
            skillValue: 0.4,        // 减速40%
            skillCooldown: 0,
            description: "减速",
            spriteTexture: "tower_hb"
        },
        
        // ========== 蓝色品质（1个）- 贵但强力 ==========
        {
            id: "tower_lightning",
            name: "闪电塔",
            rarity: TowerRarity.BLUE,
            category: TowerCategory.MAGIC,
            baseCost: 120,          // 很贵！初始金币刚好够买1个
            baseDamage: 12,         // 中伤害+连锁
            baseAttackInterval: 1.0, // 中速攻击
            baseRange: RANGE_3,      // 远程（3格）
            skillType: SkillType.CHAIN,
            skillValue: 4,          // 连锁4个敌人
            skillCooldown: 2.0,
            description: "连锁攻击",
            spriteTexture: "tower_ld"
        }
    ];

    /**
     * 根据ID获取防御塔配置
     */
    static getTowerData(id: string): TowerData | null {
        return this.TOWERS.find(t => t.id === id) || null;
    }

    /**
     * 获取品质颜色（高饱和度，便于识别）
     */
    static getRarityColor(rarity: TowerRarity): Color {
        switch (rarity) {
            case TowerRarity.WHITE:
                return new Color(255, 255, 255, 255);  // 纯白色
            case TowerRarity.GREEN:
                return new Color(0, 255, 100, 255);    // 高饱和度绿色
            case TowerRarity.BLUE:
                return new Color(100, 200, 255, 255);  // 高饱和度蓝色
            default:
                return Color.WHITE;
        }
    }

    /**
     * 获取品质名称
     */
    static getRarityName(rarity: TowerRarity): string {
        switch (rarity) {
            case TowerRarity.WHITE: return "普通";
            case TowerRarity.GREEN: return "精良";
            case TowerRarity.BLUE: return "稀有";
            default: return "未知";
        }
    }
}
