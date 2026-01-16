import { _decorator, Component, EventTouch, instantiate, Node, Prefab, Vec3, UITransform, v3, Camera, find, Label } from 'cc';
import { TileSlot, TileType } from './TileSlot';
import { Tower } from './Tower';
import { GameConfig } from './GameConfig';
import { TowerData } from './TowerType';
import { DragDropSystem } from './DragDropSystem';
import { WaveSystem } from './WaveSystem';

const { ccclass, property } = _decorator;

/**
 * 触摸管理器
 * 现在主要用于拖拽已放置的防御塔进行合并
 * 新防御塔的放置由DragDropSystem处理
 */
@ccclass('TouchManager')
export class TouchManager extends Component {
    @property(Prefab) public towerPrefab: Prefab = null!;
    @property(Camera) public mainCamera: Camera = null!;
    @property(Label) public moneyLabel: Label = null!; 

    public static money: number = GameConfig.INITIAL_MONEY;
    public static baseHealth: number = GameConfig.INITIAL_HEALTH;
    public static isGameOver: boolean = false;
    public static pendingTowerData: TowerData | null = null;
    
    private draggingTower: Node | null = null; 
    private originalTilePos: Vec3 = v3(); 
    private canvas: Node | null = null;
    private gridMap: Node | null = null;
    private dragDropSystem: DragDropSystem | null = null;
    private waveSystem: WaveSystem | null = null;

    start() {
        this.canvas = find("Canvas");
        this.gridMap = find("Canvas/GridMap");
        this.dragDropSystem = find("Canvas")?.getComponent(DragDropSystem) || find("Canvas")?.getComponentInChildren(DragDropSystem) || null;
        this.waveSystem = find("Canvas")?.getComponentInChildren(WaveSystem) || null;
        
        // 如果DragDropSystem存在，不监听触摸事件（由DragDropSystem统一处理）
        if (this.dragDropSystem) {
            console.log("TouchManager: 检测到DragDropSystem，已放置防御塔的拖拽由DragDropSystem处理");
            return;
        }
        
        // 只监听场景区域的触摸（用于拖拽已放置的防御塔）
        // 如果没有DragDropSystem，才使用TouchManager处理
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    update() {
        if (this.moneyLabel) this.moneyLabel.string = `金币: ${TouchManager.money}`;
    }

    getUIPos(event: EventTouch): Vec3 {
        const touchPos = event.getUILocation();
        const transform = this.node.getComponent(UITransform);
        if (!transform) return v3();
        return transform.convertToNodeSpaceAR(v3(touchPos.x, touchPos.y, 0));
    }

    onTouchStart(event: EventTouch) {
        if (TouchManager.isGameOver) return;
        
        // 如果DragDropSystem存在，由它统一处理所有拖拽（包括已放置防御塔的拖拽）
        if (this.dragDropSystem) {
            return;  // 让DragDropSystem处理
        }
        
        // 检查是否在备战阶段
        if (this.waveSystem && this.waveSystem.isInPreparePhase()) {
            return;  // 备战阶段由DragDropSystem处理新防御塔拖拽
        }
        
        const uiPos = this.getUIPos(event);
        const tileData = this.getTileAtPos(uiPos);
        
        if (tileData) {
            const { node } = tileData;
            const existingTower = this.getTowerOnTile(node.getPosition());

            // 只处理已放置防御塔的拖拽（用于合并）
            if (existingTower) {
                this.draggingTower = existingTower;
                this.originalTilePos = node.getPosition().clone();
                this.draggingTower.setSiblingIndex(99);
            }
        }
    }

    onTouchMove(event: EventTouch) {
        if (this.draggingTower) {
            this.draggingTower.setPosition(this.getUIPos(event));
        }
    }

    onTouchEnd(event: EventTouch) {
        if (!this.draggingTower) return;

        const uiPos = this.getUIPos(event);
        const targetTileData = this.getTileAtPos(uiPos);

        let success = false;
        if (targetTileData) {
            const { node: targetNode, script: targetScript } = targetTileData;
            const targetTower = this.getTowerOnTile(targetNode.getPosition());

            // 检查是否可以合并
            if (targetTower && targetTower !== this.draggingTower) {
                const src = this.draggingTower.getComponent(Tower);
                const dst = targetTower.getComponent(Tower);
                
                // 只能合并同类型同等级的塔，且不能超过最大等级
                if (src && dst && src.towerId === dst.towerId && src.level === dst.level && src.level < src.MAX_LEVEL) {
                    dst.absorb(src);
                    this.clearOccupied(this.originalTilePos); 
                    this.draggingTower.destroy();
                    success = true;
                }
            } else if (!targetTower && targetScript.type === TileType.EMPTY && !targetScript.isOccupied) {
                // 可以移动到新的空位置
                targetScript.isOccupied = true;
                this.clearOccupied(this.originalTilePos);
                success = true;
            }
        }

        if (!success) {
            this.draggingTower.setPosition(this.originalTilePos);
        }
        this.draggingTower = null;
    }

    clearOccupied(pos: Vec3) {
        if (!this.gridMap) {
            this.gridMap = find("Canvas/GridMap");
        }
        if (!this.gridMap) return;
        
        this.gridMap.children.forEach(c => {
            if (Vec3.distance(c.getPosition(), pos) < GameConfig.OCCUPIED_CLEAR_DISTANCE) {
                const s = c.getComponent(TileSlot);
                if (s) s.isOccupied = false;
            }
        });
    }

    getTileAtPos(uiPos: Vec3) {
        if (!this.gridMap) {
            this.gridMap = find("Canvas/GridMap");
        }
        if (!this.gridMap) return null;
        
        for (const tile of this.gridMap.children) {
            if (Vec3.distance(tile.getPosition(), uiPos) < GameConfig.TILE_DETECTION_RADIUS) {
                const script = tile.getComponent(TileSlot);
                if (script) {
                    return { node: tile, script: script };
                }
            }
        }
        return null;
    }

    getTowerOnTile(pos: Vec3): Node | null {
        if (!this.canvas) {
            this.canvas = find("Canvas");
        }
        if (!this.canvas) return null;
        
        return this.canvas.children.find(n => 
            n.name === "Tower_Instance" && 
            n.isValid && 
            Vec3.distance(n.getPosition(), pos) < GameConfig.TOWER_DETECTION_RADIUS
        ) || null;
    }

    spawnTower(pos: Vec3, towerData?: TowerData) {
        if (!this.canvas) {
            this.canvas = find("Canvas");
        }
        if (!this.canvas) return;
        
        const tower = instantiate(this.towerPrefab);
        this.canvas.addChild(tower);
        tower.name = "Tower_Instance";
        tower.setPosition(pos);
        
        // 如果提供了towerData，初始化防御塔
        if (towerData) {
            const towerScript = tower.getComponent(Tower);
            if (towerScript) {
                towerScript.init(towerData);
            }
        }
    }
}
