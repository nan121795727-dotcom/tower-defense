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
    static readonly INITIAL_MONEY = 100;      // 初始金币（紧张的开局，需要精打细算）
    static readonly INITIAL_HEALTH = 20;      // 生命值（降低容错率）
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
    // LV1→LV2: 需要2个LV1（即再拖1个）
    // LV2→LV3: 需要3个LV1
    // LV3→LV4: 需要3个LV1
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
    
    // ========== 怪物数值设计理念 ==========
    // 1-10波：怪物血少好打，但金币少，需要精打细算
    // 11-20波：血量开始增长，需要决定合成时机
    // 21-30波：血量陡增，必须有高等级塔才能应对
    //
    // 血量公式：基础血量 + (波次-1) × 每波增长 + 阶梯加成
    // 阶梯加成：11-20波额外+50%，21-30波额外+150%
    // 
    // 示例（普通怪）：
    // 第1波 = 12血
    // 第10波 = 12 + 9×8 = 84血
    // 第15波 = (12 + 14×8) × 1.5 = 186血
    // 第22波 = (12 + 21×8) × 2.5 = 450血
    // 第30波 = (12 + 29×8) × 2.5 = 610血
    
    // 普通敌人（史莱姆）- 基础怪物
    static readonly NORMAL_ENEMY_BASE_HP = 12;        // 基础血量（前期好打）
    static readonly NORMAL_ENEMY_HP_PER_WAVE = 8;     // 每波血量增长（提高）
    static readonly NORMAL_ENEMY_SPEED = 50;          // 速度
    static readonly NORMAL_ENEMY_BASE_REWARD = 2;     // 基础奖励
    static readonly NORMAL_ENEMY_REWARD_PER_5WAVE = 0;// 每5波奖励不增长
    
    // 快速敌人（蝙蝠）- 速度快但脆
    static readonly FAST_ENEMY_BASE_HP = 8;           // 基础血量（很脆）
    static readonly FAST_ENEMY_HP_PER_WAVE = 6;       // 每波血量增长（提高）
    static readonly FAST_ENEMY_SPEED = 90;            // 速度（快）
    static readonly FAST_ENEMY_BASE_REWARD = 2;       // 基础奖励
    static readonly FAST_ENEMY_REWARD_PER_5WAVE = 0;  // 每5波奖励不增长
    
    // 坦克敌人（哥布林）- 血厚但慢
    static readonly TANK_ENEMY_BASE_HP = 40;          // 基础血量（血厚）
    static readonly TANK_ENEMY_HP_PER_WAVE = 18;      // 每波血量增长（大幅提高）
    static readonly TANK_ENEMY_SPEED = 35;            // 速度（慢）
    static readonly TANK_ENEMY_BASE_REWARD = 3;       // 基础奖励
    static readonly TANK_ENEMY_REWARD_PER_5WAVE = 0;  // 每5波奖励不增长
    
    // 精英敌人（骷髅战士）- 小Boss
    static readonly ELITE_ENEMY_BASE_HP = 200;        // 基础血量（提高）
    static readonly ELITE_ENEMY_HP_PER_WAVE = 40;     // 每波血量增长（大幅提高）
    static readonly ELITE_ENEMY_SPEED = 45;           // 速度
    static readonly ELITE_ENEMY_BASE_REWARD = 8;      // 基础奖励
    static readonly ELITE_ENEMY_REWARD_PER_5WAVE = 2; // 每5波奖励增长
    
    // Boss敌人 - 最终Boss
    static readonly BOSS_ENEMY_HP = 5000;             // 固定血量（大幅提高）
    static readonly BOSS_ENEMY_SPEED = 25;            // 速度（缓慢）
    static readonly BOSS_ENEMY_REWARD = 0;            // Boss不给钱，打完就赢了
    
    // 阶梯血量加成（用于后期难度陡增）
    static readonly HP_MULTIPLIER_WAVE_11_20 = 1.5;   // 11-20波血量×1.5
    static readonly HP_MULTIPLIER_WAVE_21_30 = 2.5;   // 21-30波血量×2.5
    
    // 兼容旧代码
    static readonly ENEMY_KILL_REWARD = 2;
    static readonly ENEMY_BASE_HP = 15;
    static readonly ENEMY_HP_PER_WAVE = 8;
    static readonly ENEMY_BASE_SPEED = 50;
    static readonly ENEMY_SPEED_PER_WAVE = 0;
    
    // ========== 敌人生成配置 ==========
    static readonly MIN_WAVE_ENEMY_COUNT = 30;        // 每波最少30个怪物
    static readonly MAX_WAVE_ENEMY_COUNT = 45;        // 每波最多45个怪物
    static readonly ENEMY_SPAWN_INTERVAL = 0.8;       // 普通怪物生成间隔（基准值）
    static readonly WAVE_GAP_TIME = 5.0;              // 波次间隔
    static readonly ENEMY_TYPE_RANDOM_START_WAVE = 3; // 开始随机敌人类型的波次
    static readonly FAST_ENEMY_SPAWN_CHANCE = 0.35;   // 快速敌人出现概率
    static readonly TANK_ENEMY_SPAWN_CHANCE = 0.25;   // 坦克敌人出现概率
    
    // 根据怪物移速调整生成间隔（移速越慢，间隔越大，避免重叠）
    // 公式：基础间隔 × (基准速度 / 实际速度)
    // 普通怪(速度50) = 0.8秒
    // 快速怪(速度100) = 0.8 × 50/100 = 0.4秒
    // 坦克怪(速度30) = 0.8 × 50/30 = 1.33秒
    // 精英怪(速度45) = 0.8 × 50/45 = 0.89秒
    static readonly SPAWN_INTERVAL_BASE_SPEED = 50;   // 基准速度（普通怪物速度）
    static readonly SPAWN_INTERVAL_MIN = 0.4;         // 最小生成间隔（快速怪）
    static readonly SPAWN_INTERVAL_MAX = 1.5;         // 最大生成间隔（坦克怪）
    
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
