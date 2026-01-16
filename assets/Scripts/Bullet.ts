import { _decorator, Component, Node, Vec3, v3, find } from 'cc';
import { Enemy } from './Enemy';
import { GameConfig } from './GameConfig';
import { TowerData, SkillType, MaxLevelBonus } from './TowerType';
import { TouchManager } from './TouchManager';

const { ccclass, property } = _decorator;

@ccclass('Bullet')
export class Bullet extends Component {
    public damage: number = GameConfig.TOWER_BASE_DAMAGE;  // 整数伤害
    private target: Node | null = null;
    private speed: number = GameConfig.BULLET_SPEED;
    public towerData: TowerData | null = null;  // 防御塔数据（用于技能）
    public towerLevel: number = 1;  // 防御塔等级
    public maxLevelBonusType: MaxLevelBonus = MaxLevelBonus.NONE;  // 满级特效类型
    public maxLevelBonusValue: number = 0;  // 满级特效数值

    public setTarget(targetNode: Node) {
        this.target = targetNode;
    }

    update(dt: number) {
        // 如果游戏已结束，立即销毁子弹
        if (TouchManager.isGameOver) {
            this.node.destroy();
            return;
        }
        
        if (!this.target || !this.target.isValid) {
            this.node.destroy();
            return;
        }

        // 向目标移动
        let currentPos = this.node.getPosition();
        let targetPos = this.target.getPosition();
        let dir = v3();
        Vec3.subtract(dir, targetPos, currentPos);

        if (dir.length() < GameConfig.BULLET_HIT_DISTANCE) {
            // 命中攻击
            this.onHit(this.target);
            this.node.destroy();
        } else {
            dir.normalize();
            this.node.setPosition(currentPos.add(dir.multiplyScalar(this.speed * dt)));
        }
    }

    /**
     * 命中处理（包含技能效果）
     */
    private onHit(hitTarget: Node) {
        // 如果游戏已结束，不造成伤害
        if (TouchManager.isGameOver) {
            return;
        }
        
        const enemyScript = hitTarget.getComponent(Enemy);
        if (!enemyScript) return;

        // 基础伤害（确保整数）
        const intDamage = Math.floor(this.damage);
        enemyScript.takeDamage(intDamage);

        // 技能效果
        if (this.towerData) {
            const skillType = this.towerData.skillType;
            const skillValue = this.towerData.skillValue;

            switch (skillType) {
                case SkillType.SLOW:
                    // 减速效果
                    this.applySlow(hitTarget, skillValue);
                    break;
                
                case SkillType.SPLASH:
                    // 溅射伤害
                    this.applySplash(hitTarget, skillValue);
                    break;
                
                case SkillType.CHAIN:
                    // 连锁攻击
                    this.applyChain(hitTarget, skillValue);
                    break;
            }
        }
    }

    /**
     * 减速效果（范围减速，短持续时间）
     * 设计理念：冰法攻速慢，但每次攻击都能减速一片区域
     * 适合放在拐弯处，怪物聚集时效果最佳
     * 
     * 减速效果随等级增长：
     * - LV1: 25%减速
     * - LV2: 32%减速 (25% × 1.6 × 0.8)
     * - LV3: 40%减速 (25% × 2.2 × 0.73)
     * - LV4: 50%减速 (满级特效)
     * 
     * 满级特效：减速效果提升到50% + 范围扩大60%
     */
    private applySlow(target: Node, baseSlowPercent: number) {
        const canvas = find("Canvas");
        if (!canvas) return;
        
        const hitPos = target.getPosition();
        
        // 基础减速范围
        let slowRadius = 100;
        const slowDuration = 1.2;  // 短持续时间（需要持续攻击来维持减速）
        
        // 计算实际减速百分比（随等级增长）
        // LV1=25%, LV2=32%, LV3=40%, LV4=50%
        let actualSlowPercent = baseSlowPercent;
        if (this.towerLevel >= 2) {
            actualSlowPercent = baseSlowPercent + 0.07;  // LV2: 32%
        }
        if (this.towerLevel >= 3) {
            actualSlowPercent = baseSlowPercent + 0.15;  // LV3: 40%
        }
        if (this.towerLevel >= 4) {
            actualSlowPercent = 0.50;  // LV4: 50%（满级固定值）
        }
        
        // 满级特效：减速范围扩大
        if (this.maxLevelBonusType === MaxLevelBonus.SLOW_RANGE) {
            slowRadius = slowRadius * (1 + this.maxLevelBonusValue);
            // console.log(`[满级特效] 冰法减速范围扩大: ${slowRadius.toFixed(0)}像素, 减速${(actualSlowPercent * 100).toFixed(0)}%`);
        }
        
        // 对范围内所有敌人施加减速
        canvas.children.forEach(node => {
            if (node.name === "Enemy" && node.isValid) {
                const dist = Vec3.distance(hitPos, node.getPosition());
                if (dist <= slowRadius) {
                    const enemyScript = node.getComponent(Enemy);
                    if (enemyScript) {
                        enemyScript.applySlow(actualSlowPercent, slowDuration);
                    }
                }
            }
        });
    }

    /**
     * 溅射伤害
     * 
     * 满级特效：溅射范围大幅扩大，变成真正的AOE炮台
     */
    private applySplash(hitTarget: Node, splashPercent: number) {
        const canvas = find("Canvas");
        if (!canvas) return;

        const hitPos = hitTarget.getPosition();
        
        // 基础溅射范围
        let splashRadius = 80;
        const splashDamage = Math.floor(this.damage * splashPercent);  // 确保整数

        // 满级特效：溅射范围扩大
        if (this.maxLevelBonusType === MaxLevelBonus.SPLASH_RANGE) {
            splashRadius = splashRadius * (1 + this.maxLevelBonusValue);
            console.log(`[满级特效] 小炮溅射范围扩大: ${splashRadius.toFixed(0)}像素`);
        }

        canvas.children.forEach(node => {
            if (node.name === "Enemy" && node !== hitTarget && node.isValid) {
                const dist = Vec3.distance(hitPos, node.getPosition());
                if (dist <= splashRadius) {
                    const enemyScript = node.getComponent(Enemy);
                    if (enemyScript) {
                        enemyScript.takeDamage(splashDamage);
                    }
                }
            }
        });
    }

    /**
     * 连锁攻击
     * 
     * 满级特效：连锁数量翻倍，变成群体清场利器
     */
    private applyChain(hitTarget: Node, chainCount: number) {
        const canvas = find("Canvas");
        if (!canvas) return;

        // 满级特效：连锁数量增加
        let actualChainCount = chainCount;
        if (this.maxLevelBonusType === MaxLevelBonus.CHAIN_COUNT) {
            actualChainCount = chainCount + this.maxLevelBonusValue;
            console.log(`[满级特效] 闪电塔连锁数量增加: ${actualChainCount}个`);
        }

        let currentTarget = hitTarget;
        let chainDamage = Math.floor(this.damage * 0.8);  // 每次连锁伤害递减，确保整数
        const chainRadius = 150;
        const hitTargets: Node[] = [hitTarget];  // 记录已命中的目标，避免重复

        for (let i = 0; i < actualChainCount; i++) {
            if (!currentTarget || !currentTarget.isValid) break;

            const currentPos = currentTarget.getPosition();
            let nextTarget: Node | null = null;
            let minDist = chainRadius;

            canvas.children.forEach(node => {
                if (node.name === "Enemy" && !hitTargets.includes(node) && node.isValid) {
                    const dist = Vec3.distance(currentPos, node.getPosition());
                    if (dist < minDist) {
                        minDist = dist;
                        nextTarget = node;
                    }
                }
            });

            if (nextTarget) {
                const enemyScript = nextTarget.getComponent(Enemy);
                if (enemyScript) {
                    enemyScript.takeDamage(chainDamage);
                }
                hitTargets.push(nextTarget);
                currentTarget = nextTarget;
                chainDamage = Math.floor(chainDamage * 0.8);  // 伤害递减，确保整数
            } else {
                break;  // 没有找到下一个目标
            }
        }
    }
}
