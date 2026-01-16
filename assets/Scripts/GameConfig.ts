/**
 * 游戏配置常量
 * 集中管理游戏中的各种数值，方便调整和平衡
 * 
 * 设计理念：
 * - 初始金币有限，玩家必须做出策略选择
 * - 防御塔价格差距大：便宜塔20金 vs 贵塔120金
 * - 策略选择：
 *   A) 买1个贵塔(120金)，剩0金，等第一波收入
 *   B) 买1个中等塔(50金)+存钱，第一波中途买第2个
 *   C) 买2-3个便宜塔(20-30金)，数量多但弱，慢慢攒钱升级
 */
export class GameConfig {
    // ========== 游戏初始状态 ==========
    static readonly INITIAL_MONEY = 120;      // 初始金币（刚好买1个贵塔或2-3个便宜塔）
    static readonly INITIAL_HEALTH = 25;      // 生命值
    static readonly PREPARE_TIME = 15;        // 备战阶段时间（秒）
    
    // ========== 防御塔配置 ==========
    static readonly TOWER_COST = 50;
    static readonly TOWER_ATTACK_RANGE = 150;
    static readonly TOWER_BASE_ATTACK_INTERVAL = 1.2;
    static readonly TOWER_MIN_ATTACK_INTERVAL = 0.3;
    static readonly TOWER_ATTACK_INTERVAL_REDUCTION_PER_LEVEL = 0.1;
    static readonly TOWER_BASE_DAMAGE = 1;
    static readonly TOWER_BASE_SCALE = 0.65;  // LV1 基础大小
    static readonly TOWER_SCALE_PER_LEVEL = 0.05;  // 每级增加大小（LV4 = 0.8）
    static readonly TOWER_DAMAGE_GROWTH_PER_LEVEL = 0.6;  // 每级伤害增长60%
    
    // 合成配置：每个等级升级需要拖拽的 LV1 数量
    static readonly TOWER_MERGE_COST: number[] = [2, 3, 3];
    
    // ========== 敌人配置 ==========
    // 同一种怪物在不同波次血量和奖励都会增长
    // 
    // 数值设计理念：
    // - 前期：怪物弱、奖励少，资源紧张
    // - 中期：怪物强、奖励中等，需要持续投入
    // - 后期：怪物很强、奖励高，但升级成本也高
    // 
    // 血量公式：基础血量 + (波次-1) × 每波增长
    // 奖励公式：基础奖励 + floor((波次-1) / 5) × 奖励增长
    
    // 普通敌人（史莱姆）
    static readonly NORMAL_ENEMY_BASE_HP = 15;        // 基础血量
    static readonly NORMAL_ENEMY_HP_PER_WAVE = 8;     // 每波血量增长
    static readonly NORMAL_ENEMY_SPEED = 50;          // 速度
    static readonly NORMAL_ENEMY_BASE_REWARD = 2;     // 基础奖励
    static readonly NORMAL_ENEMY_REWARD_PER_5WAVE = 1;// 每5波奖励增长
    
    // 快速敌人（蝙蝠）
    static readonly FAST_ENEMY_BASE_HP = 10;          // 基础血量
    static readonly FAST_ENEMY_HP_PER_WAVE = 5;       // 每波血量增长
    static readonly FAST_ENEMY_SPEED = 100;           // 速度（快）
    static readonly FAST_ENEMY_BASE_REWARD = 2;       // 基础奖励
    static readonly FAST_ENEMY_REWARD_PER_5WAVE = 1;  // 每5波奖励增长
    
    // 坦克敌人（哥布林）
    static readonly TANK_ENEMY_BASE_HP = 40;          // 基础血量（高）
    static readonly TANK_ENEMY_HP_PER_WAVE = 15;      // 每波血量增长（高）
    static readonly TANK_ENEMY_SPEED = 30;            // 速度（慢）
    static readonly TANK_ENEMY_BASE_REWARD = 3;       // 基础奖励
    static readonly TANK_ENEMY_REWARD_PER_5WAVE = 1;  // 每5波奖励增长
    
    // 精英敌人（骷髅战士）
    static readonly ELITE_ENEMY_BASE_HP = 150;        // 基础血量
    static readonly ELITE_ENEMY_HP_PER_WAVE = 30;     // 每波血量增长
    static readonly ELITE_ENEMY_SPEED = 45;           // 速度
    static readonly ELITE_ENEMY_BASE_REWARD = 10;     // 基础奖励
    static readonly ELITE_ENEMY_REWARD_PER_5WAVE = 5; // 每5波奖励增长
    
    // Boss敌人
    static readonly BOSS_ENEMY_HP = 1500;             // 固定血量（很高）
    static readonly BOSS_ENEMY_SPEED = 25;            // 速度（缓慢）
    static readonly BOSS_ENEMY_REWARD = 0;            // Boss不给钱，打完就赢了
    
    // 兼容旧代码
    static readonly ENEMY_KILL_REWARD = 2;
    static readonly ENEMY_BASE_HP = 15;
    static readonly ENEMY_HP_PER_WAVE = 8;
    static readonly ENEMY_BASE_SPEED = 50;
    static readonly ENEMY_SPEED_PER_WAVE = 0;
    
    // ========== 敌人生成配置 ==========
    static readonly MIN_WAVE_ENEMY_COUNT = 30;        // 每波最少30个怪物
    static readonly MAX_WAVE_ENEMY_COUNT = 45;        // 每波最多45个怪物
    static readonly ENEMY_SPAWN_INTERVAL = 0.65;      // 敌人生成间隔（再次拉开）
    static readonly WAVE_GAP_TIME = 5.0;              // 波次间隔
    static readonly ENEMY_TYPE_RANDOM_START_WAVE = 3; // 开始随机敌人类型的波次
    static readonly FAST_ENEMY_SPAWN_CHANCE = 0.35;   // 快速敌人出现概率
    static readonly TANK_ENEMY_SPAWN_CHANCE = 0.25;   // 坦克敌人出现概率
    
    // ========== 子弹配置 ==========
    static readonly BULLET_SPEED = 800;
    static readonly BULLET_HIT_DISTANCE = 10;
    
    // ========== 敌人移动配置 ==========
    static readonly ENEMY_WAYPOINT_REACH_DISTANCE = 5;
    
    // ========== 触摸交互配置 ==========
    static readonly TILE_DETECTION_RADIUS = 50;
    static readonly TOWER_DETECTION_RADIUS = 20;
    static readonly OCCUPIED_CLEAR_DISTANCE = 10;
    
    // ========== 地块尺寸 ==========
    static readonly TILE_SIZE = 80;  // 一个地块的像素大小
}
