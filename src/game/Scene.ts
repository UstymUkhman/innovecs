import { Scene, Physics, GameObjects, Scale, Tweens } from 'phaser';
import { randomInt, randomEasing, clamp } from '@Game/utils';

import CameraManager from '@Game/Camera';
import CONFIG from '@Game/config.json';
import Player from '@Game/Player';

export default class extends Scene
{
  private sky!: GameObjects.Image;
  private stars!: GameObjects.Image;
  private clouds!: GameObjects.Group;

  private platforms: Array<Physics.Arcade.StaticGroup> = [];
  private visibleStars = window.innerHeight * 3.75;

  private ground?: Physics.Arcade.StaticGroup;
  private leftPlatform = Math.random() < 0.5;

  private platformAnimation?: Tweens.Tween;
  private playerRotation?: Tweens.Tween;
  private camera!: CameraManager;

  private minDuration = 1500;
  private gamePaused = true;
  private autoplay = false;

  private gameOver = false;
  private player!: Player;
  private score = 0;

  private center = {
    y: window.innerHeight / 2,
    x: window.innerWidth / 2
  };

  public constructor () {
    super({ key: 'Scene' });
  }

  private preload (): void {
    this.load.image('sky', 'assets/sky.png');
    this.load.image('stars', 'assets/stars.png');
    this.load.image('cloud', 'assets/cloud.png');
    this.load.image('brick', 'assets/brick.png');

    this.load.spritesheet('mario', 'assets/mario.png', {
      frameHeight: 108,
      frameWidth: 70
    });
  }

  private create (): void {
    this.createEnvironment();
    this.player = new Player(this, 'mario');
    this.player.lookLeft = this.leftPlatform;

    this.ground = this.physics.add.staticGroup({ defaultKey: 'brick' });
    this.physics.add.collider(this.player, this.ground as Physics.Arcade.StaticGroup);

    this.scale.on('resize', this.onResize, this);
    this.onResize(this.scale);

    this.createCamera();
    this.createInputEvents();
    setTimeout(this.start.bind(this), 500);
  }

  private start (): void {
    this.camera.scrollTo(this.center.y - 182, () =>
      this.camera.follow(this.player)
    );

    // this.createNextPlatform(3);
  }

  public update (): void {
    const starsArea = this.sky.displayHeight - this.visibleStars;

    this.stars.setAlpha((
      clamp(
        this.camera.y, this.visibleStars, this.sky.displayHeight
      ) - this.visibleStars
    ) / starsArea);
  }

  private createEnvironment (): void {
    this.sky = this.add.image(0, 0, 'sky').setScrollFactor(0, 1);
    this.stars = this.add.image(0, 0, 'stars').setScrollFactor(0).setAlpha(1);

    this.clouds = this.add.group(CONFIG.clouds.map(([x, y, scroll]) =>
      this.add.image(x, y, 'cloud').setScrollFactor(0, scroll)
    ));
  }

  private createCamera (): void {
    this.camera = new CameraManager(this.cameras.main);
    this.camera.y = this.cameras.main.centerY * CONFIG.levels * 2;
  }

  private createInputEvents (): void {
    this.input.on('pointerdown', this.player.jump.bind(this.player));
  }

  private createNextPlatform (bricks: number): void {
    const width = 64 * bricks;
    const p = this.platforms.length;

    const y = this.scale.height - 160 - this.score * 64;
    const x = this.leftPlatform ? 32 - width : this.scale.width + 32;

    this.platforms.push(this.physics.add.staticGroup({
      setXY: { x, y, stepX: 64 },
      defaultKey: 'brick',
      repeat: bricks - 1,
      key: 'brick'
    }));

    this.platforms[p].getChildren().forEach(platform => platform.setData('index', this.score));
    this.physics.add.collider(this.player, this.platforms[p], this.onPlatformCollision, undefined, this);

    this.platformAnimation = this.add.tween({
      props: { x: `${this.leftPlatform ? '+' : '-'}= ${this.center.x + width / 2}` },
      onUpdate: (tween, brick) => brick.refreshBody(),

      duration: randomInt(this.minDuration, 2500),
      targets: this.platforms[p].getChildren(),

      delay: randomInt(0, 1000),
      ease: randomEasing()
    });
  }

  private onPlatformCollision (player: GameObjects.GameObject, platform: GameObjects.GameObject): void {
    if (this.gameOver) return;

    if (this.physics.world.overlap(player, platform)) {
      this.onGameOver();
    }

    else if (this.player.jumping) {
      this.player.jumping = false;

      if (platform.getData('index') === this.score) {
        this.onPlatformLanding();
      }
    }
  }

  private onPlatformLanding (): void {
    this.leftPlatform = Math.random() < 0.5;
    this.player.lookLeft = this.leftPlatform;

    !this.autoplay && document.dispatchEvent(
      new CustomEvent('score:update', {
        detail: { score: ++this.score }
      })
    );

    const bricks = this.score > 24
      ? 1 : this.score > 9 ? 2 : 3;

    this.minDuration = this.score > 29
      ? 1000 : this.score > 14
      ? 1500 : 2000;

    this.camera.zoomIn(this.score);
    this.platformAnimation?.stop();
    this.createNextPlatform(bricks);
  }

  private onGameOver (): void {
    this.gameOver = true;
    this.gamePaused = true;

    this.removeInputEvents();
    this.camera.zoomOut(this.score * 140);

    this.playerRotation = this.add.tween(
      this.player.die(this.leftPlatform)
    );
  }

  private removeInputEvents (): void {
    this.input.off('pointerdown');
  }

  private onResize (size: Scale.ScaleManager): void {
    const { width, height } = size;

    this.visibleStars = height * 3.75;
    this.cameras.resize(width, height);
    this.setPlatformsPosition(width, height);

    this.center = { x: width / 2, y: height / 2 };
    this.physics.world.bounds.setSize(width, height);

    this.setSky(width, height);
    this.setClouds(width);

    this.setGround(width, height);
    this.player.resize(width, height);
  }

  private setSky (width: number, height: number): void {
    const midLevel = CONFIG.levels / 2;

    this.sky.displayWidth = width;
    this.sky.displayHeight = height * 6;

    this.sky.setPosition(
      this.center.x, this.sky.displayHeight / -midLevel
    );

    this.stars.displayWidth = height / 9 * 16;
    this.stars.displayHeight = height;

    this.stars.setPosition(
      this.center.x, this.stars.displayHeight / 2
    );
  }

  private setClouds (width: number): void {
    const xs = width < 992 ? 5 : 7.5;
    const ys = width < 992 ? 1 : 2.5;

    const cloudWidth = width / xs;
    const cloudHeight = cloudWidth / 1.406;

    this.clouds.children.iterate((child: GameObjects.GameObject, index: number) => {
      const [offsetX, offsetY] = CONFIG.clouds[index];
      const cloud = child as GameObjects.Image;
      let { x, y } = this.center;

      x += x * offsetX;
      y += y * offsetY * ys;
      cloud.setPosition(x, y);

      cloud.displayWidth = cloudWidth;
      cloud.displayHeight = cloudHeight;
    });
  }

  private setGround (width: number, height: number): void {
    const bricks = Math.ceil(width / 64);
    this.ground?.clear(true, true);

    for (let r = 2; r--;)
      for (let c = bricks; c--;)
        this.ground?.create(c * 64 + 32, height - (r * 64 + 32));
  }

  private setPlatformsPosition (width: number, height: number): void {
    for (let p = this.platforms.length; p--;) {
      const platform = this.platforms[p];
      const { x, y } = platform.getChildren()[0] as GameObjects.Image;

      platform.setXY(
        width / 2 - this.center.x + x,
        height - 160 - (this.center.y * 2 - y - 160),
        64
      ).refresh();
    }
  }
};
