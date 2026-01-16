import { _decorator, Component, EventTouch, Node, Vec3, UITransform, v3, Sprite, Color, instantiate, Prefab, find, Camera, view, Graphics } from 'cc';
import { TileSlot, TileType } from './TileSlot';
import { Tower } from './Tower';
import { TowerData } from './TowerType';
import { TouchManager } from './TouchManager';
import { WaveSystem } from './WaveSystem';
import { ShopSystem } from './ShopSystem';
import { ShopCard } from './ShopCard';

const { ccclass, property } = _decorator;

/**
 * 拖拽系统
 * 处理从商店拖拽防御塔到场景的交互
 * 支持拖到取消区域取消操作
 * 支持攻击范围可视化和选中框显示
 */
@ccclass('DragDropSystem')
export class DragDropSystem extends Component {
    @property(Prefab) public towerPrefab: Prefab = null!;
    @property(Node) public cancelArea: Node = null!;  // 取消区域
    
    private draggingCard: Node | null = null;
    private draggingTower: Node | null = null;
    private dragTowerData: TowerData | null = null;
    private canvas: Node | null = null;
    private gridMap: Node | null = null;
    private shopPanel: Node | null = null;
    private waveSystem: WaveSystem | null = null;
    private mainCamera: Camera | null = null;
    
    // 可视化相关
    private rangeCircle: Node | null = null;  // 攻击范围圈
    private selectionBox: Node | null = null;  // 地块选中框
    private towerHighlight: Node | null = null;  // 防御塔选中光圈
    private longPressTimer: number = 0;
    private isLongPressing: boolean = false;
    private longPressTarget: Node | null = null;
    private readonly LONG_PRESS_DURATION = 0.3;  // 长按时间阈值（秒）

    start() {
        this.canvas = find("Canvas");
        this.gridMap = find("Canvas/GridMap");
        this.shopPanel = find("Canvas/ShopPanel");
        this.waveSystem = find("Canvas")?.getComponentInChildren(WaveSystem) || null;
        this.mainCamera = find("Canvas/Camera")?.getComponent(Camera) || find("Main Camera")?.getComponent(Camera) || null;
        
        // 监听Canvas的触摸事件（用于拖拽）
        if (this.canvas) {
            this.canvas.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
            this.canvas.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
            this.canvas.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
            this.canvas.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
        }
        
        // 创建可视化节点
        this.createVisualNodes();
    }
    
    update(dt: number) {
        // 游戏结束时清理所有拖拽状态
        if (TouchManager.isGameOver) {
            this.cleanupOnGameOver();
            return;
        }
        
        // 处理长按计时
        if (this.isLongPressing && this.longPressTarget) {
            this.longPressTimer += dt;
            if (this.longPressTimer >= this.LONG_PRESS_DURATION) {
                this.showTowerRange(this.longPressTarget);
                this.isLongPressing = false;
            }
        }
    }
    
    /**
     * 游戏结束时清理所有拖拽和预览状态
     */
    private cleanupOnGameOver() {
        // 如果正在拖拽从商店拖出的防御塔，取消拖拽并恢复商店状态
        if (this.draggingTower) {
            // 恢复商店卡片的未购买状态
            if (this.draggingCard) {
                const shopCard = this.draggingCard.getComponent(ShopCard);
                if (shopCard) {
                    shopCard.resetPurchaseState();
                }
            }
            
            // 销毁预览
            if (this.draggingTower.isValid) {
                this.draggingTower.destroy();
            }
            this.draggingTower = null;
            this.dragTowerData = null;
            this.draggingCard = null;
        }
        
        // 如果正在拖拽已放置的防御塔，恢复其位置
        if ((this as any).draggingPlacedTower) {
            const placedTower = (this as any).draggingPlacedTower as Node;
            const originalPos = (this as any).originalTowerPosition;
            if (placedTower && placedTower.isValid && originalPos) {
                placedTower.setPosition(originalPos);
                // 恢复层级
                this.restoreTowerSiblingIndex(placedTower);
            }
            (this as any).draggingPlacedTower = null;
            (this as any).originalTowerPosition = null;
            (this as any).originalTowerTile = null;
        }
        
        // 隐藏所有可视化元素
        this.hideAllVisuals();
        
        // 重置长按状态
        this.isLongPressing = false;
        this.longPressTimer = 0;
        this.longPressTarget = null;
    }
    
    /**
     * 创建可视化节点（攻击范围圈、选中框、光圈）
     * 层级顺序：防御塔预览 > 选中提示 > 攻击范围圈
     */
    private createVisualNodes() {
        if (!this.canvas) return;
        
        // 攻击范围圈（最底层）
        this.rangeCircle = new Node("RangeCircle");
        this.canvas.addChild(this.rangeCircle);
        this.rangeCircle.addComponent(UITransform).setContentSize(500, 500);
        const rangeGraphics = this.rangeCircle.addComponent(Graphics);
        this.rangeCircle.active = false;
        
        // 地块选中框（中间层）
        this.selectionBox = new Node("SelectionBox");
        this.canvas.addChild(this.selectionBox);
        this.selectionBox.addComponent(UITransform).setContentSize(80, 80);
        const boxGraphics = this.selectionBox.addComponent(Graphics);
        this.selectionBox.active = false;
        
        // 防御塔选中光圈（中间层）
        this.towerHighlight = new Node("TowerHighlight");
        this.canvas.addChild(this.towerHighlight);
        this.towerHighlight.addComponent(UITransform).setContentSize(100, 100);
        const highlightGraphics = this.towerHighlight.addComponent(Graphics);
        this.towerHighlight.active = false;
    }
    
    /**
     * 更新可视化元素的层级
     * 顺序（从上到下）：
     * 1. 预览防御塔贴图（最上层）
     * 2. 场景中已摆放防御塔及其头顶信息 = 怪物（中间层）
     * 3. 选中提示（红绿光圈或方框）
     * 4. 攻击范围圈
     * 5. 地块（最下层）
     */
    private updateVisualsZIndex() {
        const gridMap = find("Canvas/GridMap");
        const baseIndex = gridMap ? gridMap.getSiblingIndex() : 10;
        
        // 攻击范围圈：地块之上，最底层可视化元素（baseIndex + 1）
        if (this.rangeCircle && this.rangeCircle.active) {
            this.rangeCircle.setSiblingIndex(baseIndex + 1);
        }
        
        // 选中框/光圈：攻击范围圈之上（baseIndex + 3）
        if (this.selectionBox && this.selectionBox.active) {
            this.selectionBox.setSiblingIndex(baseIndex + 3);
        }
        if (this.towerHighlight && this.towerHighlight.active) {
            this.towerHighlight.setSiblingIndex(baseIndex + 3);
        }
        
        // 已放置的防御塔和怪物在 baseIndex + 10 ~ baseIndex + 100（由Tower.updateZIndexByPosition管理）
        // 不在这里设置，由各自的组件管理
    }
    
    /**
     * 确保预览防御塔在最顶层（单独调用，在其他层级设置之后）
     */
    private ensurePreviewOnTop() {
        if (!this.canvas) return;
        
        // 使用一个非常高的固定值，确保预览始终在最顶层
        const TOP_LAYER = 9999;
        
        // 拖拽预览：最上层（高于所有其他元素）
        if (this.draggingTower && this.draggingTower.isValid) {
            this.draggingTower.setSiblingIndex(TOP_LAYER);
        }
        
        // 已放置防御塔拖拽时也要在最上层
        if ((this as any).draggingPlacedTower && (this as any).draggingPlacedTower.isValid) {
            (this as any).draggingPlacedTower.setSiblingIndex(TOP_LAYER);
        }
    }
    
    /**
     * 绘制攻击范围圈
     */
    private drawRangeCircle(range: number, color: Color = new Color(0, 255, 100, 40)) {
        if (!this.rangeCircle || !this.rangeCircle.isValid) {
            this.createVisualNodes();
            if (!this.rangeCircle) return;
        }
        
        const graphics = this.rangeCircle.getComponent(Graphics);
        if (!graphics) {
            this.rangeCircle.addComponent(Graphics);
            return;
        }
        
        graphics.clear();
        
        // 填充半透明圆（柔和的绿色）
        graphics.fillColor = color;
        graphics.circle(0, 0, range);
        graphics.fill();
        
        // 绘制边框（更亮）
        graphics.strokeColor = new Color(color.r, color.g, color.b, 200);
        graphics.lineWidth = 2;
        graphics.circle(0, 0, range);
        graphics.stroke();
        
        // 绘制内圈虚线效果 (模拟)
        graphics.strokeColor = new Color(color.r, color.g, color.b, 100);
        graphics.lineWidth = 1;
        graphics.circle(0, 0, range - 5);
        graphics.stroke();
        
        // 更新大小
        const transform = this.rangeCircle.getComponent(UITransform);
        if (transform) {
            transform.setContentSize(range * 2 + 10, range * 2 + 10);
        }
    }
    
    /**
     * 绘制地块选中框
     */
    private drawSelectionBox(canPlace: boolean) {
        if (!this.selectionBox || !this.selectionBox.isValid) {
            this.createVisualNodes();
            if (!this.selectionBox) return;
        }
        
        const graphics = this.selectionBox.getComponent(Graphics);
        if (!graphics) {
            this.selectionBox.addComponent(Graphics);
            return;
        }
        
        graphics.clear();
        
        const size = 70;  // 选中框大小
        // 使用更鲜艳的颜色
        const color = canPlace ? new Color(100, 255, 100, 80) : new Color(255, 50, 50, 80);
        const borderColor = canPlace ? new Color(100, 255, 100, 255) : new Color(255, 50, 50, 255);
        
        // 填充
        graphics.fillColor = color;
        graphics.roundRect(-size/2, -size/2, size, size, 12);
        graphics.fill();
        
        // 边框 (粗)
        graphics.strokeColor = borderColor;
        graphics.lineWidth = 4;
        graphics.roundRect(-size/2, -size/2, size, size, 12);
        graphics.stroke();
        
        // 四角装饰
        const cornerSize = 15;
        const halfSize = size/2;
        graphics.strokeColor = new Color(255, 255, 255, 200);
        graphics.lineWidth = 2;
        
        // 左上
        graphics.moveTo(-halfSize, -halfSize + cornerSize);
        graphics.lineTo(-halfSize, -halfSize);
        graphics.lineTo(-halfSize + cornerSize, -halfSize);
        graphics.stroke();
        
        // 右上
        graphics.moveTo(halfSize - cornerSize, -halfSize);
        graphics.lineTo(halfSize, -halfSize);
        graphics.lineTo(halfSize, -halfSize + cornerSize);
        graphics.stroke();
        
        // 右下
        graphics.moveTo(halfSize, halfSize - cornerSize);
        graphics.lineTo(halfSize, halfSize);
        graphics.lineTo(halfSize - cornerSize, halfSize);
        graphics.stroke();
        
        // 左下
        graphics.moveTo(-halfSize + cornerSize, halfSize);
        graphics.lineTo(-halfSize, halfSize);
        graphics.lineTo(-halfSize, halfSize - cornerSize);
        graphics.stroke();
    }
    
    /**
     * 绘制防御塔选中光圈
     */
    private drawTowerHighlight(canMerge: boolean) {
        if (!this.towerHighlight || !this.towerHighlight.isValid) {
            // 如果节点无效，尝试重新创建
            this.createVisualNodes();
            if (!this.towerHighlight) return;
        }
        
        const graphics = this.towerHighlight.getComponent(Graphics);
        if (!graphics) {
            // 如果没有 Graphics 组件，添加一个
            this.towerHighlight.addComponent(Graphics);
            return;
        }
        
        graphics.clear();
        
        const radius = 38;  // 缩小光圈
        // 合成显示金色/绿色，不能合成显示红色
        const color = canMerge ? new Color(255, 215, 0, 50) : new Color(255, 50, 50, 50);
        const borderColor = canMerge ? new Color(255, 215, 0, 255) : new Color(255, 50, 50, 255);
        
        // 填充
        graphics.fillColor = color;
        graphics.circle(0, 0, radius);
        graphics.fill();
        
        // 边框
        graphics.strokeColor = borderColor;
        graphics.lineWidth = 2;
        graphics.circle(0, 0, radius);
        graphics.stroke();
    }
    
    /**
     * 显示防御塔攻击范围（长按时）
     */
    private showTowerRange(towerNode: Node) {
        const towerScript = towerNode.getComponent(Tower);
        if (!towerScript || !this.rangeCircle) return;
        
        const range = towerScript.range || 250;
        this.drawRangeCircle(range);
        
        // 设置位置（与防御塔位置相同）
        const towerPos = towerNode.getPosition();
        this.rangeCircle.setPosition(towerPos);
        
        // 设置层级（低于防御塔，高于地块）
        const gridMap = find("Canvas/GridMap");
        if (gridMap) {
            this.rangeCircle.setSiblingIndex(gridMap.getSiblingIndex() + 1);
        }
        
        this.rangeCircle.active = true;
    }
    
    /**
     * 隐藏所有可视化
     */
    private hideAllVisuals() {
        if (this.rangeCircle) this.rangeCircle.active = false;
        if (this.selectionBox) this.selectionBox.active = false;
        if (this.towerHighlight) this.towerHighlight.active = false;
    }

    /**
     * 开始拖拽商店卡片
     */
    public startDrag(cardNode: Node, towerData: TowerData) {
        // 检查是否在备战阶段或游戏进行中
        if (this.waveSystem && this.waveSystem.isInPreparePhase()) {
            // 备战阶段可以拖拽
        } else if (TouchManager.isGameOver) {
            return;  // 游戏结束不能拖拽
        }
        
        if (TouchManager.money < towerData.baseCost) {
            console.log("金币不足，无法拖拽");
            return;  // 金币不足
        }
        
        if (!this.towerPrefab) {
            // 尝试从TouchManager获取
            const touchManager = find("Canvas")?.getComponentInChildren(TouchManager);
            if (touchManager && (touchManager as any).towerPrefab) {
                this.towerPrefab = (touchManager as any).towerPrefab;
            } else {
                console.error("towerPrefab未设置");
                return;
            }
        }
        
        this.draggingCard = cardNode;
        this.dragTowerData = towerData;
        
        // 创建拖拽预览
        this.createDragPreview(towerData);
        
        // 显示攻击范围圈
        this.drawRangeCircle(towerData.baseRange);
        if (this.rangeCircle) {
            this.rangeCircle.active = true;
            // 设置层级（低于防御塔，高于地块）
            const gridMap = find("Canvas/GridMap");
            if (gridMap) {
                this.rangeCircle.setSiblingIndex(gridMap.getSiblingIndex() + 1);
            }
        }
        
        console.log(`开始拖拽: ${towerData.name}, draggingCard: ${this.draggingCard ? this.draggingCard.name : 'null'}`);
    }

    /**
     * 创建拖拽预览
     */
    private createDragPreview(towerData: TowerData) {
        if (!this.canvas || !this.towerPrefab) return;
        
        const preview = instantiate(this.towerPrefab);
        this.canvas.addChild(preview);
        preview.name = "DragPreview";  // 重要：设置名称，Tower会检查这个名称
        
        // 立即设置最高层级（在Tower组件初始化之前）
        const maxIndex = this.canvas.children.length;
        preview.setSiblingIndex(maxIndex + 100);
        
        // 设置锚点为中心
        const previewTransform = preview.getComponent(UITransform);
        if (previewTransform) {
            previewTransform.anchorX = 0.5;
            previewTransform.anchorY = 0.5;  // 中心锚点
        }
        
        // 设置半透明
        const sprite = preview.getComponent(Sprite);
        if (sprite) {
            sprite.color = new Color(255, 255, 255, 150);
        }
        
        // 初始化防御塔数据（但禁用Tower的update逻辑）
        const towerScript = preview.getComponent(Tower);
        if (towerScript && towerData) {
            // 标记为预览模式，不显示顶部信息
            towerScript.setPreviewMode(true);
            towerScript.init(towerData);
            // 禁用Tower组件的更新，防止它修改层级
            towerScript.enabled = false;
        }
        
        this.draggingTower = preview;
    }

    /**
     * 将UI坐标转换为Canvas本地坐标
     */
    private convertUIToWorld(uiPos: Vec3): Vec3 {
        if (!this.canvas) return uiPos;
        
        const canvasTransform = this.canvas.getComponent(UITransform);
        if (!canvasTransform) return uiPos;
        
        // UI坐标系统：原点在左下角
        // Canvas坐标系统：原点在中心
        const canvasSize = canvasTransform.contentSize;
        
        // 转换为Canvas本地坐标
        const localX = uiPos.x - canvasSize.width / 2;
        const localY = uiPos.y - canvasSize.height / 2;
        
        return v3(localX, localY, 0);
    }

    /**
     * 触摸开始（由Canvas的触摸事件触发）
     */
    public onTouchStart(event: EventTouch) {
        if (TouchManager.isGameOver) return;
        
        // 如果正在拖拽商店卡片，不处理已放置防御塔的拖拽
        if (this.draggingTower || this.dragTowerData) {
            return;
        }
        
        const touchPos = event.getUILocation();
        const worldPos = this.convertUIToWorld(v3(touchPos.x, touchPos.y, 0));
        
        // 先检查是否点击在商店区域（如果是，不处理已放置防御塔的拖拽）
        if (this.shopPanel) {
            const shopPanelTransform = this.shopPanel.getComponent(UITransform);
            if (shopPanelTransform) {
                const shopPanelPos = this.shopPanel.getPosition();
                const shopPanelSize = shopPanelTransform.contentSize;
                if (Math.abs(worldPos.x - shopPanelPos.x) < shopPanelSize.width / 2 &&
                    Math.abs(worldPos.y - shopPanelPos.y) < shopPanelSize.height / 2) {
                    return;  // 在商店区域，不处理
                }
            }
        }
        
        const existingTower = this.getTowerAtPos(worldPos);
        if (existingTower) {
            // 开始长按计时
            this.isLongPressing = true;
            this.longPressTimer = 0;
            this.longPressTarget = existingTower;
            
            // 检查是否是 LV1 的塔（只有 LV1 才能拖拽合成）
            const towerScript = existingTower.getComponent(Tower);
            if (towerScript && towerScript.level === 1) {
                console.log(`开始拖拽已放置的防御塔: ${existingTower.name}, 位置: (${worldPos.x.toFixed(1)}, ${worldPos.y.toFixed(1)})`);
                (this as any).draggingPlacedTower = existingTower;
                (this as any).originalTowerPos = existingTower.getPosition().clone();
                existingTower.setSiblingIndex(999);
                
                // 显示攻击范围圈
                this.showTowerRange(existingTower);
            }
            return;
        }
    }

    /**
     * 触摸移动
     */
    public onTouchMove(event: EventTouch) {
        // 游戏结束时不处理
        if (TouchManager.isGameOver) return;
        
        // 如果正在长按检测，移动则取消长按
        if (this.isLongPressing) {
            this.isLongPressing = false;
            this.longPressTarget = null;
        }
        
        if (!this.draggingTower && !(this as any).draggingPlacedTower) return;
        
        const touchPos = event.getUILocation();
        const worldPos = this.convertUIToWorld(v3(touchPos.x, touchPos.y, 0));
        
        // 查找最近的地块（用于吸附）
        const nearestTile = this.getNearestTile(worldPos);
        const nearestTower = this.getTowerAtPosExcluding(worldPos, this.draggingTower || (this as any).draggingPlacedTower);
        
        // 更新拖拽预览位置（从商店拖拽）
        if (this.draggingTower && this.dragTowerData) {
            // 吸附到最近的地块或防御塔
            let snapPos = worldPos;
            if (nearestTower) {
                snapPos = nearestTower.getPosition().clone();
            } else if (nearestTile) {
                const tilePos = nearestTile.node.getPosition();
                snapPos = v3(tilePos.x, tilePos.y + 20, tilePos.z);  // 加上Y偏移
            }
            
            this.draggingTower.setPosition(snapPos);
            
            // 更新攻击范围圈位置
            if (this.rangeCircle && this.rangeCircle.active) {
                this.rangeCircle.setPosition(v3(snapPos.x, snapPos.y - 20, snapPos.z));
            }
            
            // 检查是否在取消区域
            if (this.cancelArea && this.isInCancelArea(worldPos)) {
                const sprite = this.draggingTower.getComponent(Sprite);
                if (sprite) {
                    sprite.color = new Color(255, 100, 100, 150);
                }
                this.hideAllVisuals();
            } else {
                const sprite = this.draggingTower.getComponent(Sprite);
                if (sprite) {
                    sprite.color = new Color(255, 255, 255, 150);
                }
                
                // 更新选中框/光圈
                this.updateDragVisuals(nearestTile, nearestTower);
            }
            
            // 确保预览始终在最顶层
            this.ensurePreviewOnTop();
        }
        
        // 更新已放置防御塔的位置（用于合并）
        if ((this as any).draggingPlacedTower) {
            // 吸附到最近的地块或防御塔
            let snapPos = worldPos;
            if (nearestTower) {
                snapPos = nearestTower.getPosition().clone();
            } else if (nearestTile) {
                const tilePos = nearestTile.node.getPosition();
                snapPos = v3(tilePos.x, tilePos.y + 20, tilePos.z);
            }
            
            (this as any).draggingPlacedTower.setPosition(snapPos);
            
            // 更新攻击范围圈位置
            if (this.rangeCircle && this.rangeCircle.active) {
                this.rangeCircle.setPosition(v3(snapPos.x, snapPos.y - 20, snapPos.z));
            }
            
            // 更新选中框/光圈（已放置防御塔拖拽）
            this.updatePlacedTowerDragVisuals(nearestTile, nearestTower);
            
            // 确保预览始终在最顶层
            this.ensurePreviewOnTop();
        }
    }
    
    /**
     * 更新拖拽时的可视化（从商店拖拽）
     */
    private updateDragVisuals(nearestTile: { node: Node; script: TileSlot } | null, nearestTower: Node | null) {
        if (!this.dragTowerData) return;
        
        // 如果悬停在防御塔上
        if (nearestTower) {
            const targetTowerScript = nearestTower.getComponent(Tower);
            const draggedTowerScript = this.draggingTower?.getComponent(Tower);
            
            // 检查是否可以合成
            const canMerge = targetTowerScript && draggedTowerScript && 
                targetTowerScript.canAbsorb(draggedTowerScript);
            
            // 显示防御塔光圈
            this.drawTowerHighlight(canMerge);
            if (this.towerHighlight) {
                this.towerHighlight.setPosition(nearestTower.getPosition());
                this.towerHighlight.active = true;
            }
            
            // 隐藏地块选中框
            if (this.selectionBox) this.selectionBox.active = false;
        } 
        // 如果悬停在地块上
        else if (nearestTile) {
            const canPlace = nearestTile.script.type === TileType.EMPTY && !nearestTile.script.isOccupied;
            
            // 显示地块选中框
            this.drawSelectionBox(canPlace);
            if (this.selectionBox) {
                this.selectionBox.setPosition(nearestTile.node.getPosition());
                this.selectionBox.active = true;
            }
            
            // 隐藏防御塔光圈
            if (this.towerHighlight) this.towerHighlight.active = false;
        } else {
            // 都没有，隐藏选中框和光圈
            if (this.selectionBox) this.selectionBox.active = false;
            if (this.towerHighlight) this.towerHighlight.active = false;
        }
        
        // 更新所有可视化元素的层级
        this.updateVisualsZIndex();
        // 确保预览在最顶层
        this.ensurePreviewOnTop();
    }
    
    /**
     * 更新已放置防御塔拖拽时的可视化
     */
    private updatePlacedTowerDragVisuals(nearestTile: { node: Node; script: TileSlot } | null, nearestTower: Node | null) {
        const srcTower = (this as any).draggingPlacedTower?.getComponent(Tower);
        if (!srcTower) return;
        
        // 如果悬停在防御塔上
        if (nearestTower) {
            const targetTowerScript = nearestTower.getComponent(Tower);
            
            // 检查是否可以合成
            const canMerge = targetTowerScript && targetTowerScript.canAbsorb(srcTower);
            
            // 显示防御塔光圈
            this.drawTowerHighlight(canMerge);
            if (this.towerHighlight) {
                this.towerHighlight.setPosition(nearestTower.getPosition());
                this.towerHighlight.active = true;
            }
            
            if (this.selectionBox) this.selectionBox.active = false;
        } 
        // 如果悬停在地块上
        else if (nearestTile) {
            const canPlace = nearestTile.script.type === TileType.EMPTY && !nearestTile.script.isOccupied;
            
            this.drawSelectionBox(canPlace);
            if (this.selectionBox) {
                this.selectionBox.setPosition(nearestTile.node.getPosition());
                this.selectionBox.active = true;
            }
            
            if (this.towerHighlight) this.towerHighlight.active = false;
        } else {
            if (this.selectionBox) this.selectionBox.active = false;
            if (this.towerHighlight) this.towerHighlight.active = false;
        }
        
        // 更新所有可视化元素的层级
        this.updateVisualsZIndex();
        // 确保预览在最顶层
        this.ensurePreviewOnTop();
    }
    
    /**
     * 获取最近的地块
     */
    private getNearestTile(pos: Vec3): { node: Node; script: TileSlot } | null {
        if (!this.gridMap) {
            this.gridMap = find("Canvas/GridMap");
        }
        if (!this.gridMap) return null;
        
        let nearestTile: { node: Node; script: TileSlot } | null = null;
        let minDistance = 60;  // 吸附距离
        
        for (const tile of this.gridMap.children) {
            const tilePos = tile.getPosition();
            const distance = Vec3.distance(pos, tilePos);
            
            if (distance < minDistance) {
                const script = tile.getComponent(TileSlot);
                if (script) {
                    minDistance = distance;
                    nearestTile = { node: tile, script: script };
                }
            }
        }
        
        return nearestTile;
    }
    
    /**
     * 获取指定位置的防御塔（排除指定节点）
     */
    private getTowerAtPosExcluding(pos: Vec3, excludeNode: Node | null): Node | null {
        if (!this.canvas) return null;
        
        let nearestTower: Node | null = null;
        let minDistance = 60;  // 吸附距离
        
        const checkNode = (node: Node) => {
            if (node === excludeNode || node.name === "DragPreview" || !node.isValid) {
                return;
            }
            
            const towerComponent = node.getComponent(Tower);
            if (towerComponent) {
                const towerPos = node.getPosition();
                const distance = Vec3.distance(towerPos, pos);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestTower = node;
                }
            }
            
            node.children.forEach(child => checkNode(child));
        };
        
        this.canvas.children.forEach(child => checkNode(child));
        
        return nearestTower;
    }

    /**
     * 触摸结束
     */
    public onTouchEnd(event: EventTouch) {
        // 停止长按检测
        this.isLongPressing = false;
        this.longPressTarget = null;
        
        // 游戏结束时清理并返回（由update中的cleanupOnGameOver处理）
        if (TouchManager.isGameOver) {
            this.hideAllVisuals();
            return;
        }
        
        const touchPos = event.getUILocation();
        const worldPos = this.convertUIToWorld(v3(touchPos.x, touchPos.y, 0));
        
        console.log(`触摸结束，位置: (${worldPos.x.toFixed(1)}, ${worldPos.y.toFixed(1)})`);
        
        // 处理拖拽新防御塔（从商店拖拽）
        if (this.draggingTower && this.dragTowerData) {
            console.log(`正在处理拖拽放置: ${this.dragTowerData.name}`);
            
            // 检查是否在取消区域
            if (this.cancelArea && this.isInCancelArea(worldPos)) {
                console.log("在取消区域，取消操作");
                // 取消操作
                this.clearDrag();
                return;
            }
            
            // 先检查是否可以合成到已放置的防御塔上
            const tileData = this.getTileAtPos(worldPos);
            if (tileData) {
                const { node: targetNode, script: targetScript } = tileData;
                const targetTower = this.getTowerOnTile(targetNode.getPosition());
                
                // 如果目标位置有防御塔，检查是否可以合成
                if (targetTower) {
                    // 重要：确保不是拖拽预览本身
                    if (targetTower === this.draggingTower || targetTower.name === "DragPreview") {
                        console.log(`检测到的是拖拽预览，跳过合成逻辑`);
                    } else {
                        const targetTowerScript = targetTower.getComponent(Tower);
                        const draggedTowerScript = this.draggingTower?.getComponent(Tower);
                        
                        // 新逻辑：从商店拖拽的都是 LV1，可以合成到任意等级的同名塔
                        if (targetTowerScript && draggedTowerScript &&
                            targetTowerScript.canAbsorb(draggedTowerScript)) {
                            // 可以合成
                            if (TouchManager.money >= this.dragTowerData.baseCost) {
                                console.log(`从商店合成到已放置防御塔: ${this.dragTowerData.name} LV${targetTowerScript.level}`);
                                const success = targetTowerScript.absorb(draggedTowerScript);
                                if (success) {
                                    TouchManager.money -= this.dragTowerData.baseCost;
                                    console.log(`合成成功！扣除了 ${this.dragTowerData.baseCost} 金币，剩余金币: ${TouchManager.money}`);
                                    
                                    // 标记商店卡片为已购买
                                    if (this.draggingCard) {
                                        const canvas = find("Canvas");
                                        const shopSystem = canvas?.getComponent(ShopSystem);
                                        if (shopSystem) {
                                            shopSystem.markCardAsPurchased(this.draggingCard);
                                        }
                                    }
                                    
                                    this.clearDrag();
                                    return;
                                }
                            } else {
                                console.log(`金币不足，无法合成。需要: ${this.dragTowerData.baseCost}, 当前: ${TouchManager.money}`);
                            }
                        } else {
                            console.log(`无法合成：${!targetTowerScript ? '目标塔组件缺失' : 
                                !draggedTowerScript ? '拖拽塔组件缺失' :
                                targetTowerScript.level >= targetTowerScript.MAX_LEVEL ? '已达最大等级' : 
                                '类型不匹配或只能用LV1合成'}`);
                        }
                    }
                }
                
                // 如果不能合成，尝试放置到空位置
                if (targetScript.type === TileType.EMPTY && !targetScript.isOccupied) {
                    // 可以放置
                    if (TouchManager.money >= this.dragTowerData.baseCost) {
                        console.log(`放置防御塔: ${this.dragTowerData.name} 在位置 (${targetNode.getPosition().x.toFixed(1)}, ${targetNode.getPosition().y.toFixed(1)})`);
                        const placed = this.placeTower(targetNode.getPosition(), this.dragTowerData);
                        if (placed) {
                            // 只有成功放置后才扣钱和占用格子
                            targetScript.isOccupied = true;
                            TouchManager.money -= this.dragTowerData.baseCost;
                            console.log(`放置成功！扣除了 ${this.dragTowerData.baseCost} 金币，剩余金币: ${TouchManager.money}`);
                            
                            // 标记商店卡片为已购买
                            if (this.draggingCard) {
                                console.log(`尝试标记商店卡片为已购买，draggingCard: ${this.draggingCard.name}`);
                                const canvas = find("Canvas");
                                const shopSystem = canvas?.getComponent(ShopSystem);
                                if (shopSystem) {
                                    console.log(`找到ShopSystem，调用markCardAsPurchased`);
                                    shopSystem.markCardAsPurchased(this.draggingCard);
                                } else {
                                    console.error(`未找到ShopSystem，无法标记卡片为已购买`);
                                }
                            } else {
                                console.warn(`draggingCard为null，无法标记为已购买`);
                            }
                        } else {
                            console.error(`放置失败！防御塔创建失败`);
                        }
                    } else {
                        console.log(`金币不足，无法放置。需要: ${this.dragTowerData.baseCost}, 当前: ${TouchManager.money}`);
                    }
                } else {
                    console.log(`格子不可用: type=${targetScript.type}, isOccupied=${targetScript.isOccupied}`);
                }
            } else {
                console.log("未找到可放置的格子");
            }
            
            this.clearDrag();
            return;
        }
        
        // 处理拖拽已放置的防御塔（合并逻辑）
        if ((this as any).draggingPlacedTower) {
            console.log(`处理已放置防御塔的拖拽结束`);
            const targetTileData = this.getTileAtPos(worldPos);
            if (targetTileData) {
                const { node: targetNode, script: targetScript } = targetTileData;
                const targetTower = this.getTowerOnTile(targetNode.getPosition());
                
                const src = (this as any).draggingPlacedTower.getComponent(Tower);
                const dst = targetTower?.getComponent(Tower);
                
                console.log(`目标格子: type=${targetScript.type}, isOccupied=${targetScript.isOccupied}`);
                console.log(`源防御塔: ${src ? `ID=${src.towerId}, level=${src.level}, exp=${src.currentExp}/${src.nextLevelNeeded}` : 'null'}`);
                console.log(`目标防御塔: ${dst ? `ID=${dst.towerId}, level=${dst.level}, exp=${dst.currentExp}/${dst.nextLevelNeeded}` : 'null'}`);
                
                // 检查是否可以合并（新逻辑：只有 LV1 的塔才能被拖去合成）
                if (targetTower && targetTower !== (this as any).draggingPlacedTower && 
                    src && dst && dst.canAbsorb(src)) {
                    // 可以合并
                    console.log(`可以合并！源: ${src.towerId} LV${src.level}, 目标: ${dst.towerId} LV${dst.level}`);
                    const success = dst.absorb(src);
                    if (success) {
                        this.clearOccupied((this as any).originalTowerPos);
                        (this as any).draggingPlacedTower.destroy();
                        console.log(`合并成功！目标防御塔新等级: ${dst.level}, 经验: ${dst.currentExp}/${dst.nextLevelNeeded}`);
                    } else {
                        // 合并失败，恢复原位置
                        (this as any).draggingPlacedTower.setPosition((this as any).originalTowerPos);
                        this.restoreTowerSiblingIndex((this as any).draggingPlacedTower);
                    }
                } else if (!targetTower && targetScript.type === TileType.EMPTY && !targetScript.isOccupied) {
                    // 可以移动到新位置
                    console.log(`移动到新位置`);
                    targetScript.isOccupied = true;
                    this.clearOccupied((this as any).originalTowerPos);
                    // 恢复层级（确保在地块之上）
                    this.restoreTowerSiblingIndex((this as any).draggingPlacedTower);
                } else {
                    // 恢复原位置
                    console.log(`无法合并或移动，恢复原位置`);
                    if (targetTower) {
                        console.log(`原因: ${targetTower === (this as any).draggingPlacedTower ? '同一防御塔' : 
                            !src || !dst ? '防御塔组件缺失' :
                            src.towerId !== dst.towerId ? '不同类型' :
                            src.level !== 1 ? '只能拖LV1合成' :
                            dst.level >= dst.MAX_LEVEL ? '目标已达最大等级' : '未知原因'}`);
                    }
                    (this as any).draggingPlacedTower.setPosition((this as any).originalTowerPos);
                    // 恢复层级（确保在地块之上）
                    this.restoreTowerSiblingIndex((this as any).draggingPlacedTower);
                }
            } else {
                // 恢复原位置
                console.log(`未找到目标格子，恢复原位置`);
                (this as any).draggingPlacedTower.setPosition((this as any).originalTowerPos);
                // 恢复层级（确保在地块之上）
                this.restoreTowerSiblingIndex((this as any).draggingPlacedTower);
            }
            
            (this as any).draggingPlacedTower = null;
            (this as any).originalTowerPos = null;
            
            // 隐藏所有可视化
            this.hideAllVisuals();
            return;
        }
        
        // 如果没有任何拖拽操作（只是长按查看攻击范围），也需要清理
        this.hideAllVisuals();
    }

    /**
     * 放置防御塔
     * @returns 是否成功放置
     */
    private placeTower(pos: Vec3, towerData: TowerData): boolean {
        if (!this.canvas || !this.towerPrefab) {
            console.error("placeTower失败: canvas或towerPrefab未设置");
            return false;
        }
        
        const tower = instantiate(this.towerPrefab);
        this.canvas.addChild(tower);
        tower.name = "Tower_Instance";  // 重要：设置正确的名称
        
        // 防御塔底部在地块底部往上20%的位置
        // 地块中心在 pos.y，地块底部在 pos.y - 50（假设地块高度100）
        // 地块底部往上20% = pos.y - 50 + 20 = pos.y - 30
        // 防御塔锚点在中心，所以需要往上偏移，让防御塔底部对齐到 pos.y - 30
        const TOWER_Y_OFFSET = -30 + 50;  // = +20，从地块中心往上偏移
        tower.setPosition(v3(pos.x, pos.y + TOWER_Y_OFFSET, pos.z));
        
        // 确保防御塔在地块之上：找到GridMap的索引，防御塔放在GridMap之后
        const gridMap = find("Canvas/GridMap");
        if (gridMap && gridMap.parent) {
            const gridMapIndex = gridMap.getSiblingIndex();
            // 防御塔应该在地块之后，但不要太高（避免遮挡UI）
            tower.setSiblingIndex(Math.min(gridMapIndex + 1, 100));
        } else {
            // 如果没有GridMap，设置为一个合理的值（确保在地块之上）
            tower.setSiblingIndex(50);
        }
        
        // 初始化防御塔
        const towerScript = tower.getComponent(Tower);
        if (towerScript) {
            towerScript.init(towerData);
            console.log(`防御塔已放置: ${towerData.name}`);
            return true;
        } else {
            console.error("placeTower失败: Tower组件未找到");
            tower.destroy();  // 清理失败的实例
            return false;
        }
    }

    /**
     * 清理拖拽状态
     */
    private clearDrag() {
        if (this.draggingTower) {
            this.draggingTower.destroy();
            this.draggingTower = null;
        }
        this.draggingCard = null;
        this.dragTowerData = null;
        
        // 隐藏所有可视化
        this.hideAllVisuals();
    }

    /**
     * 检查是否在取消区域
     */
    private isInCancelArea(pos: Vec3): boolean {
        if (!this.cancelArea) return false;
        
        const transform = this.cancelArea.getComponent(UITransform);
        if (!transform) return false;
        
        const areaPos = this.cancelArea.getWorldPosition();
        const areaSize = transform.contentSize;
        
        return Math.abs(pos.x - areaPos.x) < areaSize.width / 2 &&
               Math.abs(pos.y - areaPos.y) < areaSize.height / 2;
    }

    /**
     * 获取指定位置的格子
     * 重要：使用getPosition()而不是getWorldPosition()，因为坐标系统一致
     */
    private getTileAtPos(pos: Vec3) {
        if (!this.gridMap) {
            this.gridMap = find("Canvas/GridMap");
        }
        if (!this.gridMap) {
            console.warn("GridMap未找到");
            return null;
        }
        
        let nearestTile: { node: Node; script: TileSlot; distance: number } | null = null;
        let minDistance = 100;  // 增加检测距离到100
        
        for (const tile of this.gridMap.children) {
            // 使用getPosition()而不是getWorldPosition()，因为坐标系统一致
            const tilePos = tile.getPosition();
            const distance = Vec3.distance(pos, tilePos);
            
            if (distance < minDistance) {
                const script = tile.getComponent(TileSlot);
                if (script) {
                    minDistance = distance;
                    nearestTile = { node: tile, script: script, distance: distance };
                }
            }
        }
        
        if (nearestTile) {
            console.log(`找到最近格子，距离: ${nearestTile.distance.toFixed(1)}, type: ${nearestTile.script.type}`);
            return { node: nearestTile.node, script: nearestTile.script };
        }
        
        console.log(`未找到格子，搜索位置: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)})`);
        return null;
    }

    /**
     * 获取指定位置的防御塔
     */
    private getTowerAtPos(pos: Vec3): Node | null {
        if (!this.canvas) {
            this.canvas = find("Canvas");
        }
        if (!this.canvas) {
            console.warn("getTowerAtPos: Canvas未找到");
            return null;
        }
        
        let nearestTower: Node | null = null;
        let minDistance = 150;  // 增加检测距离到150，确保能检测到防御塔
        
        // 递归查找所有子节点中的防御塔
        const checkNode = (node: Node) => {
            // 排除拖拽预览和无效节点
            if (node.name === "DragPreview" || !node.isValid) {
                return;
            }
            
            // 通过Tower组件检测防御塔（因为节点名称会被updateAppearance修改）
            const towerComponent = node.getComponent(Tower);
            if (towerComponent) {
                const towerPos = node.getPosition();
                const distance = Vec3.distance(towerPos, pos);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestTower = node;
                }
            }
            
            // 递归检查子节点
            node.children.forEach(child => checkNode(child));
        };
        
        this.canvas.children.forEach(child => checkNode(child));
        
        if (nearestTower) {
            const towerPos = nearestTower.getPosition();
            console.log(`找到防御塔: ${nearestTower.name}, 位置: (${towerPos.x.toFixed(1)}, ${towerPos.y.toFixed(1)}), 距离: ${minDistance.toFixed(1)}`);
        } else {
            console.log(`未找到防御塔，搜索位置: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)})`);
            // 调试：列出所有防御塔的位置
            const allTowers: Node[] = [];
            const collectTowers = (node: Node) => {
                // 通过Tower组件检测防御塔
                if (node.getComponent(Tower) && node.name !== "DragPreview") {
                    allTowers.push(node);
                }
                node.children.forEach(child => collectTowers(child));
            };
            this.canvas.children.forEach(child => collectTowers(child));
            if (allTowers.length > 0) {
                console.log(`当前场景中有 ${allTowers.length} 个防御塔:`);
                allTowers.forEach((tower, index) => {
                    const towerPos = tower.getPosition();
                    const distance = Vec3.distance(towerPos, pos);
                    console.log(`  防御塔${index + 1}: ${tower.name}, 位置: (${towerPos.x.toFixed(1)}, ${towerPos.y.toFixed(1)}), 距离搜索点: ${distance.toFixed(1)}`);
                });
            } else {
                console.log("当前场景中没有防御塔");
            }
        }
        
        return nearestTower;
    }

    /**
     * 获取格子上的防御塔（只检测该格子上的，不检测相邻格子）
     */
    private getTowerOnTile(pos: Vec3): Node | null {
        if (!this.canvas) {
            this.canvas = find("Canvas");
        }
        if (!this.canvas) {
            return null;
        }
        
        // 使用较小的检测半径（30），确保只检测该格子上的防御塔，不检测相邻格子
        // 格子大小通常是75，所以30的半径应该只覆盖一个格子
        const detectionRadius = 30;
        let nearestTower: Node | null = null;
        let minDistance = detectionRadius;
        
        // 递归查找所有子节点中的防御塔
        const checkNode = (node: Node) => {
            // 排除拖拽预览和无效节点
            if (node.name === "DragPreview" || !node.isValid) {
                return;
            }
            
            // 通过Tower组件检测防御塔
            const towerComponent = node.getComponent(Tower);
            if (towerComponent) {
                const towerPos = node.getPosition();
                const distance = Vec3.distance(towerPos, pos);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestTower = node;
                }
            }
            
            // 递归检查子节点
            node.children.forEach(child => checkNode(child));
        };
        
        this.canvas.children.forEach(child => checkNode(child));
        
        return nearestTower;
    }

    /**
     * 恢复防御塔的层级（确保在地块之上）
     */
    private restoreTowerSiblingIndex(tower: Node) {
        if (!tower || !tower.isValid) return;
        
        const gridMap = find("Canvas/GridMap");
        if (gridMap && gridMap.parent) {
            const gridMapIndex = gridMap.getSiblingIndex();
            // 防御塔应该在地块之后，但不要太高（避免遮挡UI）
            tower.setSiblingIndex(Math.min(gridMapIndex + 1, 100));
        } else {
            // 如果没有GridMap，设置为一个合理的值（确保在地块之上）
            tower.setSiblingIndex(50);
        }
    }

    /**
     * 清理格子占用状态
     */
    private clearOccupied(pos: Vec3) {
        if (!this.gridMap) {
            this.gridMap = find("Canvas/GridMap");
        }
        if (!this.gridMap) return;
        
        this.gridMap.children.forEach(c => {
            if (Vec3.distance(c.getPosition(), pos) < 10) {
                const s = c.getComponent(TileSlot);
                if (s) s.isOccupied = false;
            }
        });
    }
}
