import { _decorator, Component, Label, Node, director, find, Color } from 'cc';
import { TouchManager } from './TouchManager';
import { GameConfig } from './GameConfig';
import { LevelManager } from './LevelManager';
import { WaveSystem } from './WaveSystem';
import { ShopSystem } from './ShopSystem';
import { ShopCard } from './ShopCard';
const { ccclass, property } = _decorator;

/**
 * UI控制器
 * 注意：如果使用UIBuilder自动生成UI，这个组件主要用于游戏逻辑控制
 * 旧的UI Label属性可以留空，UIBuilder会自动创建新的UI
 */
@ccclass('UIController')
export class UIController extends Component {
    @property(Label) public moneyLabel: Label = null!;
    @property(Label) public healthLabel: Label = null!;
    @property(Label) public waveLabel: Label = null!;  // 波次显示（旧UI，如果使用UIBuilder可以留空）
    @property(Label) public countdownLabel: Label = null!;  // 倒计时显示
    
    @property(Node) public resetButton: Node = null!;
    @property(Node) public pendingTowerHint: Node = null!;  // 待放置防御塔提示

    private waveSystem: WaveSystem | null = null;
    private isUsingUIBuilder: boolean = false;  // 是否使用UIBuilder生成的UI

    start() {
        // 检查是否使用UIBuilder（如果TopBar存在，说明使用了UIBuilder）
        const topBar = find("Canvas/TopBar");
        this.isUsingUIBuilder = topBar !== null;
        
        // 如果使用UIBuilder，隐藏旧的UI Label（如果存在）
        if (this.isUsingUIBuilder) {
            if (this.moneyLabel && this.moneyLabel.node) {
                this.moneyLabel.node.active = false;  // 隐藏旧的Label
            }
            if (this.healthLabel && this.healthLabel.node) {
                this.healthLabel.node.active = false;
            }
            if (this.waveLabel && this.waveLabel.node) {
                this.waveLabel.node.active = false;  // 隐藏旧的波次Label
            }
        }
        
        // 游戏开始时重置按钮应该隐藏
        if (this.resetButton) {
            this.resetButton.active = false;
        }
        
        // 隐藏待放置提示
        if (this.pendingTowerHint) {
            this.pendingTowerHint.active = false;
        }

        // 查找WaveSystem
        this.waveSystem = find("Canvas")?.getComponentInChildren(WaveSystem) || null;
    }

    update() {
        const topBar = find("Canvas/TopBar");
        if (topBar) {
            // 查找子区域
            const leftArea = topBar.getChildByName("LeftArea");
            const centerArea = topBar.getChildByName("CenterArea");
            const rightArea = topBar.getChildByName("RightArea");
            
            // 辅助查找方法：在区域内递归查找节点
            const findInArea = (area: Node | null, name: string): Node | null => {
                if (!area) return null;
                // 直接子节点
                let node = area.getChildByName(name);
                if (node) return node;
                // 检查子节点的子节点 (比如 Background -> Label)
                for (const child of area.children) {
                    node = child.getChildByName(name);
                    if (node) return node;
                }
                return null;
            };

            // 更新金币显示
            const moneyNode = findInArea(leftArea, "MoneyLabel") || topBar.getChildByName("MoneyLabel");
            if (moneyNode) {
                const moneyLabel = moneyNode.getComponent(Label);
                if (moneyLabel) {
                    moneyLabel.string = `${TouchManager.money}`;
                }
            }
            
            // 更新生命值显示
            const healthNode = findInArea(leftArea, "HealthLabel") || topBar.getChildByName("HealthLabel");
            if (healthNode) {
                const healthLabel = healthNode.getComponent(Label);
                if (healthLabel) {
                    healthLabel.string = `${TouchManager.baseHealth}`;
                }
            }
            
            // 更新波次显示
            const waveNode = findInArea(rightArea, "WaveLabel") || topBar.getChildByName("WaveLabel");
            if (waveNode) {
                const waveLabel = waveNode.getComponent(Label);
                if (waveLabel && this.waveSystem) {
                    const currentWave = this.waveSystem.getCurrentWave();
                    const totalWaves = (this.waveSystem as any).waveConfigs?.length || 30;
                    if (currentWave > 0) {
                        waveLabel.string = `${currentWave} / ${totalWaves}`;
                    } else {
                        waveLabel.string = "准备";
                    }
                }
            }
            
            // 更新倒计时显示
            const countdownNode = findInArea(centerArea, "CountdownLabel") || topBar.getChildByName("CountdownLabel");
            if (countdownNode && this.waveSystem) {
                const countdownLabel = countdownNode.getComponent(Label);
                if (countdownLabel) {
                    const prepareRemaining = this.waveSystem.getPrepareTimeRemaining();
                    const nextWaveRemaining = this.waveSystem.getNextWaveRemaining();
                    const currentWave = this.waveSystem.getCurrentWave();
                    const totalWaves = (this.waveSystem as any).waveConfigs?.length || 30;
                    
                    if (prepareRemaining > 0) {
                        // 备战阶段
                        countdownLabel.string = `⏳ 备战 ${Math.ceil(prepareRemaining)}s`;
                        countdownLabel.color = new Color(120, 255, 120);
                    } else if (currentWave >= totalWaves) {
                        // 最后一波
                        countdownLabel.string = `⚔️ 最终波`;
                        countdownLabel.color = new Color(255, 100, 100);
                    } else if (nextWaveRemaining > 0) {
                        // 显示距离下一波的时间
                        countdownLabel.string = `⏳ 下一波 ${Math.ceil(nextWaveRemaining)}s`;
                        countdownLabel.color = new Color(255, 200, 100);
                    } else {
                        countdownLabel.string = ``;
                    }
                }
            }
        } else if (!this.isUsingUIBuilder) {
            // 如果没有TopBar且不使用UIBuilder，使用旧的UI系统
            // 使用旧的UI系统
            if (this.moneyLabel) {
                this.moneyLabel.string = `金币: ${TouchManager.money}`;
            }
            if (this.healthLabel) {
                this.healthLabel.string = `生命: ${TouchManager.baseHealth}`;
            }
            if (this.waveLabel && this.waveSystem) {
                const currentWave = this.waveSystem.getCurrentWave();
                if (currentWave > 0) {
                    this.waveLabel.string = `第${currentWave}波/30波`;
                } else {
                    this.waveLabel.string = "备战阶段";
                }
            }
        }

        // 判断游戏是否失败
        if (TouchManager.baseHealth <= 0 && !TouchManager.isGameOver) {
            TouchManager.isGameOver = true;
            this.showResetMenu();
        }
        
        // 判断游戏是否胜利（第30波Boss被击杀）
        if (!TouchManager.isGameOver && !TouchManager.isVictory && this.waveSystem) {
            const currentWave = this.waveSystem.getCurrentWave();
            const totalWaves = 30;
            
            // 如果是第30波，且没有敌人存活，且不在生成阶段
            if (currentWave >= totalWaves) {
                const canvas = find("Canvas");
                if (canvas) {
                    // 检查是否还有敌人
                    const enemies = canvas.children.filter(n => n.name === "Enemy" && n.isValid);
                    // 检查是否还有待生成的敌人
                    const enemiesLeftToSpawn = (this.waveSystem as any).enemiesLeftToSpawn || 0;
                    
                    if (enemies.length === 0 && enemiesLeftToSpawn <= 0) {
                        TouchManager.isGameOver = true;
                        TouchManager.isVictory = true;
                        this.showVictoryMenu();
                    }
                }
            }
        }
    }

    showResetMenu() {
        // 优先使用UIBuilder创建的游戏结束面板
        const gameOverPanel = find("Canvas/GameOverPanel");
        if (gameOverPanel) {
            gameOverPanel.active = true;
            // 确保在最顶层（高于所有其他UI、防御塔、怪物）
            gameOverPanel.setSiblingIndex(99999);
            console.log("显示游戏结束面板 (UIBuilder)");
            
            // 隐藏旧的重置按钮（如果存在）
            if (this.resetButton) {
                this.resetButton.active = false;
            }
        } else if (this.resetButton) {
            // 回退到旧的UI系统
            this.resetButton.active = true;
            console.log("显示重置按钮 (旧UI)");
        } else {
            console.warn("GameOverPanel和resetButton都未找到");
        }
    }
    
    /**
     * 显示胜利结算界面
     */
    showVictoryMenu() {
        const victoryPanel = find("Canvas/VictoryPanel");
        if (victoryPanel) {
            victoryPanel.active = true;
            victoryPanel.setSiblingIndex(99999);
            console.log("显示胜利结算面板");
            
            // 更新统计数据
            this.updateVictoryStats(victoryPanel);
            
            // 隐藏旧的重置按钮（如果存在）
            if (this.resetButton) {
                this.resetButton.active = false;
            }
        } else {
            console.warn("VictoryPanel未找到");
        }
    }
    
    /**
     * 更新胜利界面的统计数据
     */
    private updateVictoryStats(victoryPanel: Node) {
        const banner = victoryPanel.getChildByName("Banner");
        if (!banner) return;
        
        const statsArea = banner.getChildByName("StatsArea");
        if (!statsArea) return;
        
        // 计算通关用时
        const gameTime = TouchManager.gameStartTime > 0 
            ? (Date.now() - TouchManager.gameStartTime) / 1000 
            : 0;
        const minutes = Math.floor(gameTime / 60);
        const seconds = Math.floor(gameTime % 60);
        const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // 格式化总伤害
        const damageStr = this.formatNumber(TouchManager.totalDamage);
        
        // 更新显示
        const timeRow = statsArea.getChildByName("TimeRow");
        if (timeRow) {
            const valueNode = timeRow.getChildByName("Value");
            if (valueNode) {
                const label = valueNode.getComponent(Label);
                if (label) label.string = timeStr;
            }
        }
        
        const goldRow = statsArea.getChildByName("GoldRow");
        if (goldRow) {
            const valueNode = goldRow.getChildByName("Value");
            if (valueNode) {
                const label = valueNode.getComponent(Label);
                if (label) label.string = `${TouchManager.totalGoldEarned}`;
            }
        }
        
        const damageRow = statsArea.getChildByName("DamageRow");
        if (damageRow) {
            const valueNode = damageRow.getChildByName("Value");
            if (valueNode) {
                const label = valueNode.getComponent(Label);
                if (label) label.string = damageStr;
            }
        }
    }
    
    /**
     * 格式化数字（K/M/B）
     */
    private formatNumber(num: number): string {
        if (num >= 1000000000) {
            return (num / 1000000000).toFixed(1) + 'B';
        } else if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    // 绑定给 ResetButton 的点击事件
    public onResetButtonClick() {
        console.log("点击重新挑战按钮");
        
        // 清理所有游戏对象
        this.cleanupGameObjects();
        
        // 重置游戏状态
        TouchManager.money = GameConfig.INITIAL_MONEY;
        TouchManager.baseHealth = GameConfig.INITIAL_HEALTH;
        TouchManager.isGameOver = false;
        TouchManager.isVictory = false;
        TouchManager.totalDamage = 0;
        TouchManager.totalGoldEarned = 0;
        TouchManager.gameStartTime = Date.now();  // 重新记录开始时间
        
        // 隐藏游戏结束面板和胜利面板
        const gameOverPanel = find("Canvas/GameOverPanel");
        const victoryPanel = find("Canvas/VictoryPanel");
        if (victoryPanel) {
            victoryPanel.active = false;
        }
        if (gameOverPanel) {
            gameOverPanel.active = false;
        }
        if (this.resetButton) {
            this.resetButton.active = false;
        }
        
        // 重置WaveSystem（使用公共方法）
        const canvas = find("Canvas");
        
        // 查找WaveSystem - 尝试多种方式
        let waveSystem: WaveSystem | null = null;
        if (canvas) {
            // 方式1: 直接从Canvas获取
            waveSystem = canvas.getComponent(WaveSystem);
            console.log(`WaveSystem查找方式1(Canvas直接): ${waveSystem ? '找到' : '未找到'}`);
            
            // 方式2: 使用getComponentInChildren
            if (!waveSystem) {
                waveSystem = canvas.getComponentInChildren(WaveSystem);
                console.log(`WaveSystem查找方式2(getComponentInChildren): ${waveSystem ? '找到' : '未找到'}`);
            }
            
            // 方式3: 手动遍历所有子节点
            if (!waveSystem) {
                const allNodes: Node[] = [];
                const collectAll = (n: Node) => {
                    allNodes.push(n);
                    n.children.forEach(c => collectAll(c));
                };
                collectAll(canvas);
                
                for (const node of allNodes) {
                    const ws = node.getComponent(WaveSystem);
                    if (ws) {
                        waveSystem = ws;
                        console.log(`WaveSystem查找方式3(手动遍历): 在节点 ${node.name} 上找到`);
                        break;
                    }
                }
            }
        }
        
        if (waveSystem) {
            waveSystem.resetWaveSystem();
            console.log("WaveSystem已重置成功");
        } else {
            console.error("未找到WaveSystem组件！请确保WaveSystem已挂载到场景中");
        }
        
        // 查找ShopSystem - 尝试多种方式
        let shopSystem: ShopSystem | null = null;
        if (canvas) {
            // 方式1: 直接从Canvas获取
            shopSystem = canvas.getComponent(ShopSystem);
            console.log(`ShopSystem查找方式1(Canvas直接): ${shopSystem ? '找到' : '未找到'}`);
            
            // 方式2: 使用getComponentInChildren
            if (!shopSystem) {
                shopSystem = canvas.getComponentInChildren(ShopSystem);
                console.log(`ShopSystem查找方式2(getComponentInChildren): ${shopSystem ? '找到' : '未找到'}`);
            }
            
            // 方式3: 手动遍历所有子节点
            if (!shopSystem) {
                const allNodes: Node[] = [];
                const collectAll = (n: Node) => {
                    allNodes.push(n);
                    n.children.forEach(c => collectAll(c));
                };
                collectAll(canvas);
                
                for (const node of allNodes) {
                    const ss = node.getComponent(ShopSystem);
                    if (ss) {
                        shopSystem = ss;
                        console.log(`ShopSystem查找方式3(手动遍历): 在节点 ${node.name} 上找到`);
                        break;
                    }
                }
            }
        }
        
        if (shopSystem) {
            // 先完全重置商店
            shopSystem.resetShop();
            
            // 延迟重新加载所有卡片的贴图
            const shopRef = shopSystem;
            this.scheduleOnce(() => {
                const cards = (shopRef as any).currentCards;
                if (cards && cards.length > 0) {
                    cards.forEach((card: any) => {
                        const shopCard = card.node?.getComponent(ShopCard);
                        if (shopCard) {
                            shopCard.loadTowerIcon();
                        }
                    });
                }
                console.log("商店卡片贴图已重新加载");
            }, 0.1);
            
            console.log("ShopSystem已完全重置成功");
        } else {
            console.error("未找到ShopSystem组件！请确保ShopSystem已挂载到场景中");
        }
        
        // 尝试重新加载关卡（如果LevelManager存在）
        const levelManager = find("Canvas")?.getComponent(LevelManager);
        if (levelManager) {
            levelManager.reloadCurrentLevel();
        } else {
            console.log("LevelManager不存在，使用简单重置");
        }
        
        // 更新UI显示
        // this.updateUI();
        
        console.log("游戏已重置，准备重新开始");
    }

    private cleanupGameObjects() {
        const canvas = find("Canvas");
        if (!canvas) return;
        
        console.log("开始清理所有游戏对象");
        
        // 清理所有敌人（包括所有子节点中的敌人）
        const allNodes: Node[] = [];
        const collectNodes = (node: Node) => {
            allNodes.push(node);
            node.children.forEach(child => collectNodes(child));
        };
        collectNodes(canvas);
        
        const enemies = allNodes.filter(n => {
            const enemy = n.getComponent("Enemy");
            return enemy !== null || n.name === "Enemy" || n.name.includes("Enemy");
        });
        enemies.forEach(enemy => {
            if (enemy.isValid) {
                enemy.destroy();
            }
        });
        console.log(`清理了 ${enemies.length} 个敌人`);
        
        // 清理所有子弹（包括所有子节点中的子弹）
        const bullets = allNodes.filter(n => {
            const bullet = n.getComponent("Bullet");
            return bullet !== null || n.name.includes("Bullet");
        });
        bullets.forEach(bullet => {
            if (bullet.isValid) {
                bullet.destroy();
            }
        });
        console.log(`清理了 ${bullets.length} 个子弹`);
        
        // 清理所有防御塔（包括拖拽预览）
        const towers = allNodes.filter(n => {
            const tower = n.getComponent("Tower");
            return tower !== null || n.name === "Tower_Instance" || n.name.includes("Tower") || n.name === "DragPreview";
        });
        towers.forEach(tower => {
            if (tower.isValid) {
                tower.destroy();
            }
        });
        console.log(`清理了 ${towers.length} 个防御塔`);
        
        // 重置所有格子的占用状态
        const gridMap = find("Canvas/GridMap");
        if (gridMap) {
            gridMap.children.forEach(tile => {
                const slot = tile.getComponent("TileSlot");
                if (slot) {
                    (slot as any).isOccupied = false;
                }
            });
            console.log("所有格子占用状态已重置");
        }
        
        console.log("游戏对象清理完成");
    }
}
