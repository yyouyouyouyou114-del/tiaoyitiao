/**
 * 跳一跳游戏主类
 * 实现物理引擎、平台生成、碰撞检测等核心功能
 */

// 音频管理器将通过全局变量访问

// 游戏常量配置
const CONFIG = {
  // 物理参数
  GRAVITY: 0.6,
  JUMP_FORCE: 15,
  MIN_POWER: 0.3,
  MAX_POWER: 1.0,
  
  // 平台参数
  PLATFORM_WIDTH: 80,
  PLATFORM_HEIGHT: 20,
  BASE_DISTANCE: 100,
  DIFFICULTY_FACTOR: 1.5,
  
  // 玩家参数
  PLAYER_SIZE: 30,
  PLAYER_COLOR: '#FF6B6B',
  
  // 游戏参数
  GROUND_Y: 300,  // 横屏时调整地面高度
  PERFECT_TOLERANCE: 5,
  
  // 特效参数
  PARTICLE_COUNT: 8,
  PARTICLE_LIFE: 30
};

// 游戏状态枚举
const GAME_STATE = {
  START: 'start',
  CHARGING: 'charging',
  JUMPING: 'jumping',
  GAME_OVER: 'game_over'
};

// 平台类型
const PLATFORM_TYPE = {
  NORMAL: 'normal',
  BONUS: 'bonus',
  SPRING: 'spring'
};

class JumpGame {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.gameState = GAME_STATE.START;
    
    // 游戏对象
    this.player = null;
    this.platforms = [];
    this.particles = [];
    
    // 游戏数据
    this.score = 0;
    this.combo = 0;
    this.camera = { x: 0, y: 0 };
    
    // 输入控制
    this.touchStartTime = 0;
    this.chargePower = 0;
    this.isCharging = false;
    
    // 动画帧
    this.animationId = null;
    
    // 音频管理器（延迟初始化）
    this.audioManager = null;
  }

  /**
   * 初始化游戏
   */
  init() {
    // 初始化音频管理器
    try {
      if (window.AudioManager) {
        this.audioManager = new window.AudioManager();
        console.log('AudioManager initialized successfully');
      } else {
        console.warn('AudioManager not available, audio features will be disabled');
        this.audioManager = null;
      }
    } catch (error) {
      console.warn('Failed to initialize AudioManager:', error);
      this.audioManager = null;
    }
    
    this.setupCanvas();
    this.initGameObjects();
    this.bindEvents();
    this.startGameLoop();
  }

  /**
   * 设置Canvas
   */
  setupCanvas() {
    this.canvas = GameGlobal.canvas;
    this.ctx = this.canvas.getContext('2d');
    
    // Web环境适配
    if (typeof wx !== 'undefined' && wx.getSystemInfoSync) {
      // 微信小游戏环境
      const systemInfo = wx.getSystemInfoSync();
      this.canvas.width = Math.max(systemInfo.screenWidth, systemInfo.screenHeight);
      this.canvas.height = Math.min(systemInfo.screenWidth, systemInfo.screenHeight);
    } else {
      // Web浏览器环境，使用预设尺寸
      this.canvas.width = this.canvas.width || 375;
      this.canvas.height = this.canvas.height || 667;
    }
    
    // 更新地面高度为屏幕高度的80%
    CONFIG.GROUND_Y = this.canvas.height * 0.8;
  }

  /**
   * 初始化游戏对象
   */
  initGameObjects() {
    // 创建玩家
    this.player = new Player(
      this.canvas.width / 2 - CONFIG.PLAYER_SIZE / 2,
      CONFIG.GROUND_Y - CONFIG.PLAYER_SIZE
    );
    
    // 创建初始平台
    this.platforms = [
      new Platform(this.canvas.width / 2 - CONFIG.PLATFORM_WIDTH / 2, CONFIG.GROUND_Y, PLATFORM_TYPE.NORMAL),
      new Platform(this.canvas.width / 2 + 150, CONFIG.GROUND_Y, PLATFORM_TYPE.NORMAL)
    ];
    
    // 重置游戏数据
    this.score = 0;
    this.combo = 0;
    this.camera.x = 0;
    this.gameState = GAME_STATE.START;
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    // 绑定触摸事件到canvas
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.handleTouchStart(e.changedTouches[0]);
    });
    
    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.handleTouchEnd(e.changedTouches[0]);
    });
    
    // Web环境也绑定鼠标事件作为备用
    this.canvas.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.handleTouchStart({ clientX: e.clientX, clientY: e.clientY });
    });
    
    this.canvas.addEventListener('mouseup', (e) => {
      e.preventDefault();
      this.handleTouchEnd({ clientX: e.clientX, clientY: e.clientY });
    });
    
    // 只在微信小游戏环境中绑定全局触摸事件
    if (typeof wx !== 'undefined' && wx.onTouchStart) {
      wx.onTouchStart((e) => {
        this.handleTouchStart(e.changedTouches[0]);
      });
      
      wx.onTouchEnd((e) => {
        this.handleTouchEnd(e.changedTouches[0]);
      });
    }
  }

  /**
   * 处理触摸开始
   */
  async handleTouchStart(touch) {
    // 恢复音频上下文（用户交互后）
    if (this.audioManager) {
      await this.audioManager.resumeAudioContext();
    }
    
    if (this.gameState === GAME_STATE.START) {
      this.gameState = GAME_STATE.CHARGING;
      this.isCharging = true;
      this.touchStartTime = Date.now();
      this.chargePower = 0;
      
      // 开始播放背景音乐
      if (this.audioManager) {
        this.audioManager.startBackgroundMusic();
      }
    } else if (this.gameState === GAME_STATE.GAME_OVER) {
      this.restart();
    }
  }

  /**
   * 处理触摸结束
   */
  handleTouchEnd(touch) {
    if (this.gameState === GAME_STATE.CHARGING && this.isCharging) {
      this.isCharging = false;
      this.jump();
    }
  }

  /**
   * 玩家跳跃
   */
  jump() {
    if (this.gameState !== GAME_STATE.CHARGING) return;
    
    // 计算跳跃力度
    const power = Math.min(this.chargePower, CONFIG.MAX_POWER);
    
    // 找到目标平台
    const targetPlatform = this.getNextPlatform();
    if (!targetPlatform) {
      this.gameOver();
      return;
    }
    
    // 计算跳跃参数 - 修复物理计算
    const distance = targetPlatform.x - this.player.x;
    const initialVy = CONFIG.JUMP_FORCE * power;
    // 计算到达最高点的时间，然后乘以2得到总飞行时间
    const jumpTime = (2 * initialVy) / CONFIG.GRAVITY;
    const horizontalSpeed = distance / jumpTime;
    
    this.player.jump(power, horizontalSpeed);
    this.gameState = GAME_STATE.JUMPING;
    
    // 播放跳跃音效
    if (this.audioManager) {
      this.audioManager.playJumpSound();
    }
  }

  /**
   * 获取下一个平台
   */
  getNextPlatform() {
    return this.platforms.find(platform => 
      platform.x > this.player.x + CONFIG.PLAYER_SIZE
    );
  }

  /**
   * 更新游戏逻辑
   */
  update() {
    // 更新蓄力
    if (this.isCharging) {
      const chargeTime = (Date.now() - this.touchStartTime) / 1000;
      this.chargePower = Math.min(chargeTime * 0.8, CONFIG.MAX_POWER);
      console.log('Charging... Power:', this.chargePower.toFixed(2), 'Time:', chargeTime.toFixed(2));
    }
    
    // 更新玩家
    this.player.update();
    
    // 检查着陆
    if (this.gameState === GAME_STATE.JUMPING && this.player.isLanding()) {
      this.checkLanding();
    }
    
    // 更新粒子
    this.updateParticles();
    
    // 更新摄像机
    this.updateCamera();
    
    // 生成新平台
    this.generatePlatforms();
  }

  /**
   * 检查着陆
   */
  checkLanding() {
    // 只有在下降时才检测着陆
    if (!this.player.isJumping || this.player.vy <= 0) return;
    
    const landedPlatform = this.platforms.find(platform => 
      this.player.x + CONFIG.PLAYER_SIZE/2 > platform.x &&
      this.player.x + CONFIG.PLAYER_SIZE/2 < platform.x + CONFIG.PLATFORM_WIDTH &&
      this.player.y + CONFIG.PLAYER_SIZE >= platform.y &&
      this.player.y + CONFIG.PLAYER_SIZE <= platform.y + CONFIG.PLATFORM_HEIGHT + 5
    );
    
    // 检查是否落到地面
    if (this.player.y + CONFIG.PLAYER_SIZE >= CONFIG.GROUND_Y) {
      if (landedPlatform) {
        // 成功着陆到平台
        this.player.land(landedPlatform.y - CONFIG.PLAYER_SIZE);
        this.handleSuccessfulLanding(landedPlatform);
        this.createLandingParticles();
        this.gameState = GAME_STATE.START;
      } else {
        // 着陆失败
        this.gameOver();
      }
    }
  }

  /**
   * 处理成功着陆
   */
  handleSuccessfulLanding(platform) {
    // 计算分数
    const centerX = platform.x + CONFIG.PLATFORM_WIDTH / 2;
    const playerCenterX = this.player.x + CONFIG.PLAYER_SIZE / 2;
    const distance = Math.abs(centerX - playerCenterX);
    
    if (distance <= CONFIG.PERFECT_TOLERANCE) {
      // 完美着陆
      this.combo++;
      this.score += 2 + this.combo;
      if (this.audioManager) {
        this.audioManager.playPerfectLandingSound();
      }
    } else {
      // 普通着陆
      this.combo = 0;
      this.score += 1;
      if (this.audioManager) {
        this.audioManager.playLandingSound();
      }
    }
    
    // 处理特殊平台
    if (platform.type === PLATFORM_TYPE.BONUS) {
      this.score += 5;
    }
  }

  /**
   * 创建着陆粒子效果
   */
  createLandingParticles() {
    for (let i = 0; i < CONFIG.PARTICLE_COUNT; i++) {
      this.particles.push(new Particle(
        this.player.x + CONFIG.PLAYER_SIZE / 2,
        this.player.y + CONFIG.PLAYER_SIZE,
        (Math.random() - 0.5) * 8,
        -Math.random() * 5 - 2
      ));
    }
  }

  /**
   * 更新粒子
   */
  updateParticles() {
    this.particles = this.particles.filter(particle => {
      particle.update();
      return particle.life > 0;
    });
  }

  /**
   * 更新摄像机
   */
  updateCamera() {
    // 游戏结束时保持摄像机静止
    if (this.gameState === GAME_STATE.GAME_OVER) {
      return;
    }
    
    const targetX = this.player.x - this.canvas.width / 2;
    this.camera.x += (targetX - this.camera.x) * 0.1;
  }

  /**
   * 生成新平台
   */
  generatePlatforms() {
    const lastPlatform = this.platforms[this.platforms.length - 1];
    const rightmostX = lastPlatform.x;
    
    // 如果最右边的平台距离摄像机不够远，生成新平台
    if (rightmostX < this.camera.x + this.canvas.width + 200) {
      const newX = rightmostX + CONFIG.BASE_DISTANCE + Math.random() * 100 + this.score * CONFIG.DIFFICULTY_FACTOR;
      const type = this.getRandomPlatformType();
      this.platforms.push(new Platform(newX, CONFIG.GROUND_Y, type));
    }
    
    // 清理离开屏幕的平台
    this.platforms = this.platforms.filter(platform => 
      platform.x > this.camera.x - 200
    );
  }

  /**
   * 获取随机平台类型
   */
  getRandomPlatformType() {
    const rand = Math.random();
    if (rand < 0.1) return PLATFORM_TYPE.BONUS;
    if (rand < 0.15) return PLATFORM_TYPE.SPRING;
    return PLATFORM_TYPE.NORMAL;
  }

  /**
   * 游戏结束
   */
  gameOver() {
    this.gameState = GAME_STATE.GAME_OVER;
    // 播放游戏结束音效并停止背景音乐
    if (this.audioManager) {
      this.audioManager.playGameOverSound();
      this.audioManager.stopBackgroundMusic();
    }
    // 可以添加震动效果
    // wx.vibrateShort({ type: 'heavy' });
  }

  /**
   * 重新开始游戏
   */
  restart() {
    this.initGameObjects();
    this.particles = [];
  }

  /**
   * 渲染游戏
   */
  render() {
    // 清空画布
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // 保存上下文
    this.ctx.save();
    
    // 应用摄像机变换
    this.ctx.translate(-this.camera.x, -this.camera.y);
    
    // 绘制背景
    this.renderBackground();
    
    // 绘制平台
    this.platforms.forEach(platform => platform.render(this.ctx));
    
    // 绘制玩家
    this.player.render(this.ctx);
    
    // 绘制粒子
    this.particles.forEach(particle => particle.render(this.ctx));
    
    // 恢复上下文
    this.ctx.restore();
    
    // 绘制UI
    this.renderUI();
    
    // 绘制蓄力指示器
    if (this.gameState === GAME_STATE.CHARGING) {
      this.renderChargeIndicator();
    }
    
    // 绘制游戏结束界面
    if (this.gameState === GAME_STATE.GAME_OVER) {
      this.renderGameOver();
    }
  }

  /**
   * 渲染背景 - 森林主题
   */
  renderBackground() {
    // 森林天空渐变背景
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    gradient.addColorStop(0, '#87CEEB');  // 天空蓝
    gradient.addColorStop(0.3, '#98FB98'); // 浅绿
    gradient.addColorStop(1, '#228B22');   // 森林绿
    
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(
      this.camera.x - 100, 
      this.camera.y - 100, 
      this.canvas.width + 200, 
      this.canvas.height + 200
    );
    
    // 绘制远景树木
    this.renderBackgroundTrees();
    
    // 绘制阳光效果
    this.renderSunlight();
    
    // 绘制飘落的叶子
    this.renderFloatingLeaves();
  }
  
  /**
   * 渲染背景树木
   */
  renderBackgroundTrees() {
    const treeSpacing = 150;
    const startX = Math.floor((this.camera.x - 200) / treeSpacing) * treeSpacing;
    
    for (let x = startX; x < this.camera.x + this.canvas.width + 200; x += treeSpacing) {
      const treeHeight = 80 + Math.sin(x * 0.01) * 20;
      const treeY = this.canvas.height - 50;
      
      // 树干
      this.ctx.fillStyle = '#8B4513';
      this.ctx.fillRect(x - this.camera.x, treeY - treeHeight * 0.3, 8, treeHeight * 0.3);
      
      // 树冠
      this.ctx.fillStyle = '#228B22';
      this.ctx.beginPath();
      this.ctx.arc(x - this.camera.x + 4, treeY - treeHeight * 0.5, treeHeight * 0.4, 0, Math.PI * 2);
      this.ctx.fill();
      
      // 树冠高光
      this.ctx.fillStyle = '#32CD32';
      this.ctx.beginPath();
      this.ctx.arc(x - this.camera.x + 2, treeY - treeHeight * 0.6, treeHeight * 0.2, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }
  
  /**
   * 渲染阳光效果
   */
  renderSunlight() {
    // 太阳
    this.ctx.fillStyle = '#FFD700';
    this.ctx.beginPath();
    this.ctx.arc(this.canvas.width - 80, 60, 25, 0, Math.PI * 2);
    this.ctx.fill();
    
    // 阳光光线
    this.ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
    this.ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI * 2) / 8;
      const startX = this.canvas.width - 80 + Math.cos(angle) * 35;
      const startY = 60 + Math.sin(angle) * 35;
      const endX = this.canvas.width - 80 + Math.cos(angle) * 50;
      const endY = 60 + Math.sin(angle) * 50;
      
      this.ctx.beginPath();
      this.ctx.moveTo(startX, startY);
      this.ctx.lineTo(endX, endY);
      this.ctx.stroke();
    }
  }
  
  /**
   * 渲染飘落的叶子
   */
  renderFloatingLeaves() {
    const time = Date.now() * 0.001;
    
    for (let i = 0; i < 5; i++) {
      const x = (this.camera.x + i * 200 + Math.sin(time + i) * 50) % (this.canvas.width + 100);
      const y = 50 + Math.sin(time * 0.5 + i) * 30 + (time * 20 + i * 50) % this.canvas.height;
      
      // 叶子
      this.ctx.fillStyle = i % 2 === 0 ? '#228B22' : '#32CD32';
      this.ctx.save();
      this.ctx.translate(x - this.camera.x, y);
      this.ctx.rotate(time + i);
      this.ctx.beginPath();
      this.ctx.ellipse(0, 0, 3, 6, 0, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }
  }

  /**
   * 渲染UI
   */
  renderUI() {
    this.ctx.fillStyle = '#333';
    this.ctx.font = 'bold 24px Arial';
    this.ctx.fillText(`分数: ${this.score}`, 20, 40);
    
    if (this.combo > 0) {
      this.ctx.fillStyle = '#FF6B6B';
      this.ctx.fillText(`连击: ${this.combo}`, 20, 70);
    }
    
    // 显示游戏状态和提示
    if (this.gameState === GAME_STATE.START) {
      this.ctx.fillStyle = '#666';
      this.ctx.font = '20px Arial';
      this.ctx.fillText('点击屏幕开始蓄力跳跃', 20, this.canvas.height - 40);
    } else if (this.gameState === GAME_STATE.CHARGING) {
      this.ctx.fillStyle = '#FF6B6B';
      this.ctx.font = '20px Arial';
      this.ctx.fillText('蓄力中... 松开跳跃', 20, this.canvas.height - 40);
    }
  }

  /**
   * 渲染蓄力指示器
   */
  renderChargeIndicator() {
    const barWidth = 200;
    const barHeight = 20;
    const x = (this.canvas.width - barWidth) / 2;
    const y = 100;
    
    // 背景
    this.ctx.fillStyle = '#DDD';
    this.ctx.fillRect(x, y, barWidth, barHeight);
    
    // 蓄力条
    const fillWidth = (this.chargePower / CONFIG.MAX_POWER) * barWidth;
    this.ctx.fillStyle = this.chargePower > 0.8 ? '#FF4444' : '#4CAF50';
    this.ctx.fillRect(x, y, fillWidth, barHeight);
    
    // 边框
    this.ctx.strokeStyle = '#333';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x, y, barWidth, barHeight);
  }

  /**
   * 渲染游戏结束界面
   */
  renderGameOver() {
    // 半透明遮罩
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // 游戏结束文本
    this.ctx.fillStyle = '#FFF';
    this.ctx.font = 'bold 36px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('游戏结束', this.canvas.width / 2, this.canvas.height / 2 - 50);
    
    this.ctx.font = '24px Arial';
    this.ctx.fillText(`最终分数: ${this.score}`, this.canvas.width / 2, this.canvas.height / 2);
    
    this.ctx.font = '18px Arial';
    this.ctx.fillText('点击屏幕重新开始', this.canvas.width / 2, this.canvas.height / 2 + 50);
    
    this.ctx.textAlign = 'left';
  }

  /**
   * 开始游戏循环
   */
  startGameLoop() {
    const gameLoop = () => {
      this.update();
      this.render();
      this.animationId = requestAnimationFrame(gameLoop);
    };
    
    gameLoop();
  }

  /**
   * 停止游戏循环
   */
  stopGameLoop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
}

/**
 * 玩家类
 */
class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.isJumping = false;
    this.size = CONFIG.PLAYER_SIZE;
  }

  jump(power, horizontalSpeed) {
    this.vy = -CONFIG.JUMP_FORCE * power;
    this.vx = horizontalSpeed;
    this.isJumping = true;
  }

  update() {
    if (this.isJumping) {
      this.x += this.vx;
      this.y += this.vy;
      this.vy += CONFIG.GRAVITY;
    }
  }

  land(y) {
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.isJumping = false;
  }

  isLanding() {
    return this.isJumping && this.vy > 0 && this.y >= CONFIG.GROUND_Y - this.size;
  }

  render(ctx) {
    const centerX = this.x + this.size / 2;
    const centerY = this.y + this.size / 2;
    const scale = this.size / 30; // 缩放比例
    
    // 绘制森林小松鼠身体（椭圆形，棕色）
    ctx.fillStyle = '#8B4513';
    ctx.beginPath();
    ctx.ellipse(centerX, centerY + 3 * scale, 10 * scale, 12 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#654321';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // 绘制肚子（浅棕色）
    ctx.fillStyle = '#D2B48C';
    ctx.beginPath();
    ctx.ellipse(centerX, centerY + 5 * scale, 6 * scale, 8 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // 绘制松鼠头部（圆形，棕色）
    ctx.fillStyle = '#8B4513';
    ctx.beginPath();
    ctx.arc(centerX, centerY - 5 * scale, 8 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#654321';
    ctx.stroke();
    
    // 绘制松鼠耳朵（尖尖的）
    ctx.fillStyle = '#8B4513';
    ctx.beginPath();
    // 左耳
    ctx.ellipse(centerX - 5 * scale, centerY - 11 * scale, 2 * scale, 4 * scale, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // 右耳
    ctx.beginPath();
    ctx.ellipse(centerX + 5 * scale, centerY - 11 * scale, 2 * scale, 4 * scale, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // 绘制耳朵内侧（浅棕色）
    ctx.fillStyle = '#D2B48C';
    ctx.beginPath();
    ctx.ellipse(centerX - 5 * scale, centerY - 11 * scale, 1 * scale, 2 * scale, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(centerX + 5 * scale, centerY - 11 * scale, 1 * scale, 2 * scale, 0.3, 0, Math.PI * 2);
    ctx.fill();
    
    // 绘制大眼睛（黑色）
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(centerX - 3 * scale, centerY - 6 * scale, 2 * scale, 0, Math.PI * 2);
    ctx.arc(centerX + 3 * scale, centerY - 6 * scale, 2 * scale, 0, Math.PI * 2);
    ctx.fill();
    
    // 绘制眼睛高光
    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.arc(centerX - 2.5 * scale, centerY - 6.5 * scale, 0.8 * scale, 0, Math.PI * 2);
    ctx.arc(centerX + 3.5 * scale, centerY - 6.5 * scale, 0.8 * scale, 0, Math.PI * 2);
    ctx.fill();
    
    // 绘制小鼻子（黑色）
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(centerX, centerY - 3 * scale, 0.8 * scale, 0, Math.PI * 2);
    ctx.fill();
    
    // 绘制嘴巴
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX - 1.5 * scale, centerY - 1 * scale, 1.5 * scale, 0, Math.PI);
    ctx.arc(centerX + 1.5 * scale, centerY - 1 * scale, 1.5 * scale, 0, Math.PI);
    ctx.stroke();
    
    // 绘制蓬松的大尾巴
    ctx.fillStyle = '#8B4513';
    ctx.beginPath();
    ctx.arc(centerX - 10 * scale, centerY + 5 * scale, 6 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#654321';
    ctx.stroke();
    
    // 绘制尾巴高光
    ctx.fillStyle = '#D2B48C';
    ctx.beginPath();
    ctx.arc(centerX - 12 * scale, centerY + 3 * scale, 3 * scale, 0, Math.PI * 2);
    ctx.fill();
    
    // 绘制小爪子
    ctx.fillStyle = '#654321';
    ctx.beginPath();
    ctx.ellipse(centerX - 4 * scale, centerY + 12 * scale, 1.5 * scale, 1 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(centerX + 4 * scale, centerY + 12 * scale, 1.5 * scale, 1 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * 平台类
 */
class Platform {
  constructor(x, y, type = PLATFORM_TYPE.NORMAL) {
    this.x = x;
    this.y = y;
    this.width = CONFIG.PLATFORM_WIDTH;
    this.height = CONFIG.PLATFORM_HEIGHT;
    this.type = type;
  }

  render(ctx) {
    // 根据类型设置颜色和样式
    switch (this.type) {
      case PLATFORM_TYPE.BONUS:
        // 金色奖励平台
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(this.x, this.y, this.width, 3);
        break;
      case PLATFORM_TYPE.SPRING:
        // 粉色弹簧平台
        ctx.fillStyle = '#FF69B4';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(this.x, this.y, this.width, 3);
        break;
      default:
        // 绿色草地平台
        this.renderGrassland(ctx);
    }
    
    // 绘制中心点标记（用于完美着陆）
    const centerX = this.x + this.width / 2;
    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.arc(centerX, this.y - 5, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  
  renderGrassland(ctx) {
    // 绘制森林地面底色（深棕色土壤）
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(this.x, this.y, this.width, this.height);
    
    // 绘制苔藓表面（深绿色）
    ctx.fillStyle = '#556B2F';
    ctx.fillRect(this.x, this.y, this.width, this.height * 0.4);
    
    // 绘制树桩纹理
    ctx.fillStyle = '#A0522D';
    const ringCount = 3;
    for (let i = 0; i < ringCount; i++) {
      const ringY = this.y + (this.height * 0.6) + (i * 2);
      ctx.fillRect(this.x + 2, ringY, this.width - 4, 1);
    }
    
    // 绘制小蘑菇
    const mushroomSeed = this.x * 0.1; // 使用位置作为随机种子
    if (Math.sin(mushroomSeed) > 0.3) {
      const mushroomX = this.x + 10 + (Math.sin(mushroomSeed * 2) * 20);
      const mushroomY = this.y - 3;
      
      // 蘑菇杆
      ctx.fillStyle = '#F5DEB3';
      ctx.fillRect(mushroomX, mushroomY, 2, 4);
      
      // 蘑菇帽
      ctx.fillStyle = '#DC143C';
      ctx.beginPath();
      ctx.arc(mushroomX + 1, mushroomY, 3, 0, Math.PI * 2);
      ctx.fill();
      
      // 蘑菇帽斑点
      ctx.fillStyle = '#FFF';
      ctx.beginPath();
      ctx.arc(mushroomX - 1, mushroomY - 1, 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(mushroomX + 2, mushroomY + 1, 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // 绘制小树苗
    if (Math.cos(mushroomSeed) > 0.5) {
      const saplingX = this.x + this.width - 15;
      const saplingY = this.y - 2;
      
      // 树苗茎
      ctx.strokeStyle = '#228B22';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(saplingX, saplingY + 3);
      ctx.lineTo(saplingX, saplingY - 2);
      ctx.stroke();
      
      // 树苗叶子
      ctx.fillStyle = '#32CD32';
      ctx.beginPath();
      ctx.arc(saplingX - 1, saplingY - 1, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(saplingX + 1, saplingY, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // 绘制落叶装饰
    for (let i = 0; i < 3; i++) {
      const leafX = this.x + 5 + (i * 25) + Math.sin(mushroomSeed + i) * 5;
      const leafY = this.y - 1;
      
      ctx.fillStyle = i % 2 === 0 ? '#8B4513' : '#DAA520';
      ctx.save();
      ctx.translate(leafX, leafY);
      ctx.rotate(Math.sin(mushroomSeed + i) * 0.5);
      ctx.beginPath();
      ctx.ellipse(0, 0, 2, 1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

/**
 * 粒子类
 */
class Particle {
  constructor(x, y, vx, vy) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.life = CONFIG.PARTICLE_LIFE;
    this.maxLife = CONFIG.PARTICLE_LIFE;
    this.size = Math.random() * 4 + 2;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.3; // 重力
    this.life--;
  }

  render(ctx) {
    const alpha = this.life / this.maxLife;
    ctx.fillStyle = `rgba(255, 107, 107, ${alpha})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { default: JumpGame };
} else {
  window.JumpGame = JumpGame;
}