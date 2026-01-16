import { _decorator, Component, Prefab, instantiate, Node, UITransform, v3, size } from 'cc';
const { ccclass, property, executeInEditMode } = _decorator;

/**
 * 网格生成器（保留用于编辑器模式）
 * 注意：游戏运行时应该使用 LevelLoader 来加载关卡
 */
@ccclass('GridGenerator')
@executeInEditMode
export class GridGenerator extends Component {
    @property(Prefab) public tilePrefab: Prefab = null!;
    @property public gridSize: number = 75; 

    @property public generate: boolean = false; // 编辑器模式下生成网格

    update() {
        if (this.generate) {
            this.generate = false;
            this.createGrid();
        }
    }

    createGrid() {
        // 清空现有，确保没有残留
        this.node.removeAllChildren();
        
        for (let r = 0; r < 18; r++) {
            for (let c = 0; c < 10; c++) {
                let tile = instantiate(this.tilePrefab);
                this.node.addChild(tile);
                
                // 计算格子位置
                let posX = (c - 4.5) * this.gridSize;
                let posY = (r - 8.5) * this.gridSize;
                tile.setPosition(v3(posX, posY, 0));
                
                tile.name = `Tile_${r}_${c}`;
            }
        }
        console.log("网格生成完成，请开始设计地图布局");
    }
}
