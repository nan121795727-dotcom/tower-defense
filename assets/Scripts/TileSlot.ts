import { _decorator, Component, Sprite, SpriteFrame, Color, v3, Enum, EDITOR } from 'cc';
const { ccclass, property, executeInEditMode } = _decorator;

// �̶�ö�ٶ��壬��Ҫ���޸�˳�򣬷�ֹ���ݴ���
export enum TileType {
    VOID = 0,
    PATH = 1,
    EMPTY = 2,
    START = 3,
    END = 4
}
Enum(TileType);

@ccclass('TileSlot')
@executeInEditMode(true)
export class TileSlot extends Component {
    @property(SpriteFrame) public grassImg: SpriteFrame = null!;
    @property(SpriteFrame) public dirtImg: SpriteFrame = null!;
    @property(SpriteFrame) public rockImg: SpriteFrame = null!;

    @property({ type: TileType })
    public type: TileType = TileType.EMPTY;

    public isOccupied: boolean = false;

    // �༭����ʵʱˢ��
    update() {
        if (EDITOR) {
            this.updateVisual();
        }
    }

    start() {
        this.updateVisual();
    }

    updateVisual() {
        const sprite = this.getComponent(Sprite);
        if (!sprite) return;

        if (EDITOR) {
            // --- �༭��ģʽ�����׸ɵ�ͼƬ��ֻ��ɫ�� ---
            sprite.spriteFrame = null; 
            switch (this.type) {
                case TileType.EMPTY: sprite.color = new Color(50, 150, 50); break;   // ��
                case TileType.PATH:  sprite.color = new Color(150, 100, 50); break;  // ��
                case TileType.START: sprite.color = new Color(50, 50, 200); break;   // ��
                case TileType.END:   sprite.color = new Color(200, 50, 50); break;   // ��
                case TileType.VOID:  sprite.color = new Color(80, 80, 80); break;    // ��
            }
        } else {
            // --- ����ģʽ�����Ͼ�����ͼ ---
            let targetFrame: SpriteFrame | null = null;
            switch (this.type) {
                case TileType.EMPTY: targetFrame = this.grassImg; break;
                case TileType.PATH:
                case TileType.START:
                case TileType.END:   targetFrame = this.dirtImg; break;
                case TileType.VOID:  targetFrame = this.rockImg; break;
            }

            if (targetFrame) {
                sprite.spriteFrame = targetFrame;
                // 临时测试：使用更亮的颜色（如果看起来更亮了，说明确实有暗化问题）
                // 注意：Color的值范围是0-255，但实际渲染时会归一化到0-1
                // 这里我们使用纯白色，如果还是暗，可能是相机或场景设置问题
                sprite.color = new Color(255, 255, 255, 255);
                
                // 调试：输出颜色值确认
                if (this.node.name === "Tile_0_0") {
                    console.log(`[TileSlot] Tile颜色已设置为: R=${sprite.color.r}, G=${sprite.color.g}, B=${sprite.color.b}, A=${sprite.color.a}`);
                    console.log(`[TileSlot] SpriteFrame: ${sprite.spriteFrame?.name}`);
                }
            }
        }

        // ·�����Ŵ������Ӿ����ݣ�
        if (this.type === TileType.PATH || this.type === TileType.START || this.type === TileType.END) {
            this.node.setScale(v3(0.96, 0.96, 1));
        } else {
            this.node.setScale(v3(1, 1, 1));
        }
    }
}