/**
 * PlayerHUD - Main player HUD using three-mesh-ui
 * Displays health, mana, experience bars and player info
 */

import * as THREE from 'three';
import ThreeMeshUI from 'three-mesh-ui';
import { UIManager } from '../UIManager';
import { EventEmitter } from '../../utils/EventEmitter';

export interface PlayerHUDData {
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  experience: number;
  experienceToLevel: number;
  level: number;
  name: string;
  className: string;
}

export class PlayerHUD extends EventEmitter {
  private uiManager: UIManager;
  private container: ThreeMeshUI.Block | null = null;
  private healthBar: ThreeMeshUI.Block | null = null;
  private healthFill: ThreeMeshUI.Block | null = null;
  private manaBar: ThreeMeshUI.Block | null = null;
  private manaFill: ThreeMeshUI.Block | null = null;
  private expBar: ThreeMeshUI.Block | null = null;
  private expFill: ThreeMeshUI.Block | null = null;
  private healthText: ThreeMeshUI.Text | null = null;
  private manaText: ThreeMeshUI.Text | null = null;
  private levelText: ThreeMeshUI.Text | null = null;

  constructor() {
    super();
    this.uiManager = UIManager.instance;
  }

  public create(): ThreeMeshUI.Block {
    this.container = new ThreeMeshUI.Block({
      width: 0.5,
      height: 0.2,
      padding: 0.01,
      backgroundColor: new THREE.Color(0x1a1a1a),
      backgroundOpacity: 0.8,
      borderRadius: 0.01,
      contentDirection: 'column',
      justifyContent: 'start',
      alignItems: 'center',
    });

    // Player name and level
    const nameRow = new ThreeMeshUI.Block({
      width: 0.48,
      height: 0.04,
      contentDirection: 'row',
      justifyContent: 'space-between',
      backgroundOpacity: 0,
    });
    nameRow.add(this.uiManager.createText('Player', { fontSize: 0.025 }));
    this.levelText = this.uiManager.createText('Lv. 1', { fontSize: 0.02, color: 0xffd700 }) as ThreeMeshUI.Text;
    nameRow.add(this.levelText);
    this.container.add(nameRow);

    // Health bar
    this.healthBar = this.createBar(0.48, 0.04, 0x333333);
    this.healthFill = this.createBarFill(0.48, 0.04, 0xcc3333);
    this.healthBar.add(this.healthFill);
    this.healthText = this.uiManager.createText('100/100', { fontSize: 0.018 }) as ThreeMeshUI.Text;
    this.healthBar.add(this.healthText);
    this.container.add(this.healthBar);

    // Mana bar
    this.manaBar = this.createBar(0.48, 0.035, 0x333333);
    this.manaFill = this.createBarFill(0.48, 0.035, 0x3366cc);
    this.manaBar.add(this.manaFill);
    this.manaText = this.uiManager.createText('50/50', { fontSize: 0.016 }) as ThreeMeshUI.Text;
    this.manaBar.add(this.manaText);
    this.container.add(this.manaBar);

    // Experience bar
    this.expBar = this.createBar(0.48, 0.025, 0x222222);
    this.expFill = this.createBarFill(0.48, 0.025, 0x9933cc);
    this.expBar.add(this.expFill);
    this.container.add(this.expBar);

    return this.container;
  }

  private createBar(width: number, height: number, color: number): ThreeMeshUI.Block {
    return new ThreeMeshUI.Block({
      width,
      height,
      backgroundColor: new THREE.Color(color),
      borderRadius: 0.005,
      justifyContent: 'center',
      alignItems: 'center',
    });
  }

  private createBarFill(width: number, height: number, color: number): ThreeMeshUI.Block {
    return new ThreeMeshUI.Block({
      width: width * 0.98,
      height: height * 0.8,
      backgroundColor: new THREE.Color(color),
      borderRadius: 0.003,
    });
  }

  public update(data: PlayerHUDData): void {
    const healthPercent = data.maxHealth > 0 ? data.health / data.maxHealth : 0;
    const manaPercent = data.maxMana > 0 ? data.mana / data.maxMana : 0;
    const expPercent = data.experienceToLevel > 0 ? data.experience / data.experienceToLevel : 0;

    if (this.healthFill) {
      this.healthFill.set({ width: 0.47 * healthPercent });
    }
    if (this.healthText) {
      this.healthText.set({ content: `${Math.floor(data.health)}/${data.maxHealth}` });
    }
    if (this.manaFill) {
      this.manaFill.set({ width: 0.47 * manaPercent });
    }
    if (this.manaText) {
      this.manaText.set({ content: `${Math.floor(data.mana)}/${data.maxMana}` });
    }
    if (this.expFill) {
      this.expFill.set({ width: 0.47 * expPercent });
    }
    if (this.levelText) {
      this.levelText.set({ content: `Lv. ${data.level}` });
    }
  }

  public setPosition(x: number, y: number, z: number): void {
    if (this.container) {
      this.container.position.set(x, y, z);
    }
  }

  public show(): void {
    if (this.container) this.container.visible = true;
  }

  public hide(): void {
    if (this.container) this.container.visible = false;
  }
}

