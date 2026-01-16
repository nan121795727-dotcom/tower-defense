import { _decorator, Component, Node, Vec3, v3, find } from 'cc';
import { Enemy } from './Enemy';
import { GameConfig } from './GameConfig';
import { TowerData, SkillType } from './TowerType';
import { TouchManager } from './TouchManager';

const { ccclass, property } = _decorator;

@ccclass('Bullet')
export class Bullet extends Component {
    public damage: number = GameConfig.TOWER_BASE_DAMAGE;  // 整数伤害
    private target: Node | null = null;
    private speed: number = GameConfig.BULLET_SPEED;
    public towerData: TowerData | null = null;  // 防御塔数据（用于技能）
    public towerLevel: number = 1;  // 防御塔等级

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
     * 减速效果
     */
    private applySlow(target: Node, slowPercent: number) {
        const enemyScript = target.getComponent(Enemy);
        if (enemyScript) {
            enemyScript.applySlow(slowPercent, 3.0);  // 减速3秒
        }
    }

    /**
     * 溅射伤害
     */
    private applySplash(hitTarget: Node, splashPercent: number) {
        const canvas = find("Canvas");
        if (!canvas) return;

        const hitPos = hitTarget.getPosition();
        const splashRadius = 80;  // 溅射范围
        const splashDamage = Math.floor(this.damage * splashPercent);  // 确保整数

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
     */
    private applyChain(hitTarget: Node, chainCount: number) {
        const canvas = find("Canvas");
        if (!canvas) return;

        let currentTarget = hitTarget;
        let chainDamage = Math.floor(this.damage * 0.8);  // 每次连锁伤害递减，确保整数
        const chainRadius = 150;

        for (let i = 0; i < chainCount; i++) {
            if (!currentTarget || !currentTarget.isValid) break;

            const currentPos = currentTarget.getPosition();
            let nextTarget: Node | null = null;
            let minDist = chainRadius;

            canvas.children.forEach(node => {
                if (node.name === "Enemy" && node !== currentTarget && node.isValid) {
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
                currentTarget = nextTarget;
                chainDamage = Math.floor(chainDamage * 0.8);  // 伤害递减，确保整数
            } else {
                break;  // 没有找到下一个目标
            }
        }
    }
}
