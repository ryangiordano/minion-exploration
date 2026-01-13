import Phaser from 'phaser';

export interface EdgeScrollCameraConfig {
  /** Width of edge zones that trigger scrolling (pixels) */
  edgeSize?: number;
  /** Camera scroll speed (pixels per second) */
  scrollSpeed?: number;
}

const DEFAULT_EDGE_SIZE = 50;
const DEFAULT_SCROLL_SPEED = 400;

/**
 * RTS-style camera that scrolls when the mouse is near screen edges.
 */
export class EdgeScrollCamera {
  private scene: Phaser.Scene;
  private camera: Phaser.Cameras.Scene2D.Camera;
  private edgeSize: number;
  private scrollSpeed: number;

  constructor(scene: Phaser.Scene, config: EdgeScrollCameraConfig = {}) {
    this.scene = scene;
    this.camera = scene.cameras.main;
    this.edgeSize = config.edgeSize ?? DEFAULT_EDGE_SIZE;
    this.scrollSpeed = config.scrollSpeed ?? DEFAULT_SCROLL_SPEED;
  }

  /**
   * Call in scene update loop with delta time
   */
  update(delta: number): void {
    const pointer = this.scene.input.activePointer;

    // Get viewport-relative position (not world position)
    const viewX = pointer.x;
    const viewY = pointer.y;

    const viewWidth = this.camera.width;
    const viewHeight = this.camera.height;

    // Calculate scroll amount for this frame
    const scrollAmount = (this.scrollSpeed * delta) / 1000;

    let dx = 0;
    let dy = 0;

    // Check horizontal edges
    if (viewX < this.edgeSize) {
      dx = -scrollAmount;
    } else if (viewX > viewWidth - this.edgeSize) {
      dx = scrollAmount;
    }

    // Check vertical edges
    if (viewY < this.edgeSize) {
      dy = -scrollAmount;
    } else if (viewY > viewHeight - this.edgeSize) {
      dy = scrollAmount;
    }

    // Apply scroll (camera bounds will clamp automatically)
    if (dx !== 0 || dy !== 0) {
      this.camera.scrollX += dx;
      this.camera.scrollY += dy;
    }
  }
}
