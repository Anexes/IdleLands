
import { Dependencies, Container } from 'constitute';

import { Character } from '../../core/base/character';

import { Logger } from '../../shared/logger';
import { SETTINGS } from '../../static/settings';

import { Statistics } from '../statistics/statistics';

import { PlayerMovement } from './player.movement';

import { emitter } from './_emitter';

@Dependencies(Container)
export class Player extends Character {
  constructor(container) {
    super();
    const PlayerDb = require('./player.db').PlayerDb;
    try {
      container.schedulePostConstructor((playerDb, statistics, playerMovement) => {
        this.PlayerDb = playerDb;
        this.$statistics = statistics;
        this.PlayerMovement = playerMovement;
      }, [PlayerDb, Statistics, PlayerMovement]);
    } catch (e) {
      Logger.error('Player', e);
    }
  }

  init(opts) {
    super.init(opts);

    if(!this.joinDate)  this.joinDate = Date.now();
    if(!this.region)    this.region = 'Wilderness';
    if(!this.gold)      this.gold = 0;
    if(!this.map)       this.map = 'Norkos';
    if(!this.x)         this.x = 10;
    if(!this.y)         this.y = 10;
  }

  takeTurn() {
    this.moveAction();
    this.save();
  }

  levelUp() {
    if(this.level === SETTINGS.maxLevel) return;
    this._level.add(1);
    this.resetMaxXp();
    this._xp.toMinimum();
    emitter.emit('player:levelup', { worker: this.$worker, player: this });
  }

  gainXp(xp = 1) {
    this._xp.add(xp);

    if(xp > 0) {
      this.$statistics.incrementStat('Character.XP.Gain', xp);
    } else {
      this.$statistics.incrementStat('Character.XP.Lose', -xp);
    }

    if(this._xp.atMaximum()) this.levelUp();
  }

  moveAction() {

    let [newLoc, dir] = this.PlayerMovement.pickRandomTile(this);
    let tile = this.PlayerMovement.getTileAt(this.map, newLoc.x, newLoc.y);

    while(!this.PlayerMovement.canEnterTile(this, tile)) {
      [newLoc, dir] = this.PlayerMovement.pickRandomTile(this);
      tile = this.PlayerMovement.getTileAt(this.map, newLoc.x, newLoc.y);
    }

    this.lastDir = dir === 5 ? null : dir;
    this.x = newLoc.x;
    this.y = newLoc.y;

    this.oldRegion = this.mapRegion;
    this.mapRegion = tile.region;

    this.PlayerMovement.handleTile(this, tile);

    this.stepCooldown--;

    this.$statistics.batchIncrement(['Character.Steps', `Character.Terrains.${tile.terrain}`, `Character.Regions.${tile.region}`]);

    // TODO xpGain stat
    this.gainXp(10);
  }

  save() {
    this.PlayerDb.savePlayer(this);
  }
}