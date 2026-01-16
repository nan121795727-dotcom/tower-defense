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
 * 满级特色强化类型
 * 每个塔在满级时有独特的特征放大效果
 * 注意：不包含射程修改，避免玩家认知冲突
 */
export enum MaxLevelBonus {
    NONE = 0,              // 无特殊效果（纯数值提升）
    ATTACK_SPEED = 1,      // 攻速大幅提升
    DAMAGE = 2,            // 伤害大幅提升
    SLOW_RANGE = 3,        // 减速范围扩大
    SPLASH_RANGE = 4,      // 溅射范围扩大
    CHAIN_COUNT = 5        // 连锁数量增加
}
Enum(MaxLevelBonus);

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
    // === 满级特色强化 ===
    maxLevelBonus: MaxLevelBonus;  // 满级特殊效果类型
    maxLevelBonusValue: number;    // 满级特殊效果数值
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
 * 防御塔价格设计（初始金币100）：
 * 
 * 核心设计理念：
 * - 开局最多只能买3个塔（紧张的资源选择）
 * - 如果运气好抽到同名塔，可以合成1个2级塔（惊喜感）
 * - 绿色/蓝色塔需要攒钱，是中后期目标
 * 
 * 白色塔(35金)：100金 ÷ 35 = 2.8，最多买2个，剩30金
 * 如果混搭便宜的射手：2×35 + 30 = 100金，刚好3个
 * 
 * 策略选择示例：
 * A) 3个射手(30×3=90金) = 10金剩余，纯铺量
 * B) 2个法师(35×2=70金) + 存30金，等第一波收入
 * C) 1个战士(40金) + 2个射手(60金) = 0金，混搭策略
 * D) 存钱策略：1个塔 + 等第一波收入买绿色塔
 * 
 * 惊喜时刻：
 * - 抽到2个同名塔 → 合成2级！（概率约1/6）
 * - 抽到3个同名塔 → 2级+进度！（概率极低，约1/36）
 */
export class TowerConfig {
    static readonly TOWERS: TowerData[] = [
        // ========== 白色品质（3个）- 便宜但基础 ==========
        // 设计理念：100金最多买3个塔，需要精打细算
        // 射手最便宜(30金)，其他白色塔(35金)
        // 100 ÷ 30 = 3.3 → 最多3个射手(90金)
        // 100 ÷ 35 = 2.8 → 最多2个法师/战士(70金)
        // 混搭：2×30 + 35 = 95金，或 30 + 35×2 = 100金
        {
            id: "tower_archer",
            name: "射手",
            rarity: TowerRarity.WHITE,
            category: TowerCategory.PHYSICAL,
            baseCost: 30,           // 最便宜，铺量首选
            baseDamage: 5,          // 低伤害，DPS≈8.3
            baseAttackInterval: 0.6, // 快速攻击
            baseRange: RANGE_3,      // 远程（3格）- 核心优势
            skillType: SkillType.NONE,
            skillValue: 0,
            description: "远程物理",
            spriteTexture: "tower_gj",
            // 满级特色：攻速再提升50%，变成超高频射手
            maxLevelBonus: MaxLevelBonus.ATTACK_SPEED,
            maxLevelBonusValue: 0.5  // 攻击间隔再减少50%
        },
        {
            id: "tower_mage",
            name: "法师",
            rarity: TowerRarity.WHITE,
            category: TowerCategory.MAGIC,
            baseCost: 35,           // 稍贵，但DPS更高
            baseDamage: 10,         // 中伤害，DPS=10
            baseAttackInterval: 1.0, // 中速攻击
            baseRange: RANGE_2,      // 中程（2格）
            skillType: SkillType.NONE,
            skillValue: 0,
            description: "远程魔法",
            spriteTexture: "tower_fs",
            // 满级特色：伤害大幅提升，变成高爆发法师
            maxLevelBonus: MaxLevelBonus.DAMAGE,
            maxLevelBonusValue: 0.8  // 伤害额外+80%
        },
        {
            id: "tower_guard",
            name: "战士",
            rarity: TowerRarity.WHITE,
            category: TowerCategory.PHYSICAL,
            baseCost: 40,           // 最贵的白色塔
            baseDamage: 18,         // 高伤害，DPS=12
            baseAttackInterval: 1.5, // 慢速攻击
            baseRange: RANGE_1,      // 近程（1格）- 需要好位置
            skillType: SkillType.NONE,
            skillValue: 0,
            description: "高伤害",
            spriteTexture: "tower_sw",
            // 满级特色：伤害大幅提升，变成单体爆发王
            maxLevelBonus: MaxLevelBonus.DAMAGE,
            maxLevelBonusValue: 1.0  // 伤害额外+100%（翻倍）
        },
        
        // ========== 绿色品质（2个）- 中等价格有技能 ==========
        // 设计理念：开局买不起，需要第1-2波收入后购买
        // 第1波约30只怪 × 1金 = 30金收入
        // 开局剩10金 + 30金 = 40金，还是买不起绿色塔
        // 需要更精细的经济规划
        {
            id: "tower_cannon",
            name: "小炮",
            rarity: TowerRarity.GREEN,
            category: TowerCategory.AOE,
            baseCost: 60,           // 需要攒钱
            baseDamage: 20,         // 高伤害+溅射
            baseAttackInterval: 2.0, // 极慢攻击
            baseRange: RANGE_2,      // 中程（2格）- 符合"炮"的射程直觉
            skillType: SkillType.SPLASH,
            skillValue: 0.5,        // 溅射50%伤害
            skillCooldown: 0,
            description: "范围伤害",
            spriteTexture: "tower_hp",
            // 满级特色：溅射范围大幅扩大，变成真正的AOE炮台
            maxLevelBonus: MaxLevelBonus.SPLASH_RANGE,
            maxLevelBonusValue: 0.8  // 溅射范围+80%
        },
        {
            id: "tower_ice",
            name: "冰法",
            rarity: TowerRarity.GREEN,
            category: TowerCategory.SUPPORT,
            baseCost: 65,           // 控制型，稍贵
            baseDamage: 8,          // 低伤害（主要靠减速）
            baseAttackInterval: 2.0, // 慢速攻击
            baseRange: RANGE_2,      // 中程（2格）
            skillType: SkillType.SLOW,
            skillValue: 0.25,       // 基础减速25%（升级后增强）
            skillCooldown: 0,
            description: "范围减速",
            spriteTexture: "tower_hb",
            // 满级特色：减速效果大幅增强（25%→50%）+ 范围扩大
            maxLevelBonus: MaxLevelBonus.SLOW_RANGE,
            maxLevelBonusValue: 0.6  // 减速范围+60%
        },
        
        // ========== 蓝色品质（1个）- 贵但强力 ==========
        // 设计理念：中期目标，需要3-5波收入积累
        {
            id: "tower_lightning",
            name: "闪电塔",
            rarity: TowerRarity.BLUE,
            category: TowerCategory.MAGIC,
            baseCost: 120,          // 需要积累几波收入
            baseDamage: 15,         // 中伤害+连锁
            baseAttackInterval: 1.0, // 中速攻击
            baseRange: RANGE_3,      // 远程（3格）
            skillType: SkillType.CHAIN,
            skillValue: 3,          // 连锁3个敌人
            skillCooldown: 2.0,
            description: "连锁攻击",
            spriteTexture: "tower_ld",
            // 满级特色：连锁数量翻倍，变成群体清场利器
            maxLevelBonus: MaxLevelBonus.CHAIN_COUNT,
            maxLevelBonusValue: 3    // 连锁数量+3（共6个）
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
