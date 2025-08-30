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
  PLAYER_SIZE: 90,
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
    
    // 手机端功能
    this.enableVibration = false;
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
   * 设置Canvas - 专门优化手机横屏体验
   */
  setupCanvas() {
    this.canvas = GameGlobal.canvas;
    this.ctx = this.canvas.getContext('2d');
    
    // 获取设备像素比，确保高清显示
    const dpr = window.devicePixelRatio || 1;
    
    // 计算最佳画布尺寸
    let canvasWidth, canvasHeight;
    
    if (typeof wx !== 'undefined' && wx.getSystemInfoSync) {
      // 微信小游戏环境
      const systemInfo = wx.getSystemInfoSync();
      canvasWidth = systemInfo.screenWidth;
      canvasHeight = systemInfo.screenHeight;
    } else {
      // Web浏览器环境，完全自适应屏幕
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      
      // 判断设备方向和类型
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isLandscape = screenWidth > screenHeight;
      
      if (isMobile) {
        // 移动设备：专门优化手机体验
        canvasWidth = screenWidth;
        canvasHeight = screenHeight;
        
        // 手机横屏模式专门优化
        if (isLandscape) {
          // 手机横屏：根据屏幕尺寸动态调整游戏参数
          const screenRatio = screenWidth / screenHeight;
          
          // 根据屏幕比例调整游戏参数
          if (screenRatio > 2.0) {
            // 超宽屏手机（如折叠屏）
            CONFIG.BASE_DISTANCE = Math.max(180, screenWidth * 0.08);
            CONFIG.PLATFORM_WIDTH = Math.max(100, screenWidth * 0.05);
            CONFIG.JUMP_FORCE = 25;
            CONFIG.PLAYER_SIZE = Math.max(60, screenHeight * 0.08);
            CONFIG.GRAVITY = 0.8;
          } else if (screenRatio > 1.8) {
            // 标准横屏手机
            CONFIG.BASE_DISTANCE = Math.max(150, screenWidth * 0.1);
            CONFIG.PLATFORM_WIDTH = Math.max(90, screenWidth * 0.06);
            CONFIG.JUMP_FORCE = 22;
            CONFIG.PLAYER_SIZE = Math.max(55, screenHeight * 0.09);
            CONFIG.GRAVITY = 0.75;
          } else {
            // 较窄的横屏手机
            CONFIG.BASE_DISTANCE = Math.max(120, screenWidth * 0.12);
            CONFIG.PLATFORM_WIDTH = Math.max(80, screenWidth * 0.07);
            CONFIG.JUMP_FORCE = 20;
            CONFIG.PLAYER_SIZE = Math.max(50, screenHeight * 0.1);
            CONFIG.GRAVITY = 0.7;
          }
          
          // 手机横屏特殊优化
          CONFIG.GROUND_Y = this.logicalHeight * 0.85; // 地面位置更低
          CONFIG.PERFECT_TOLERANCE = 8; // 增加完美着陆容差
                 } else {
           // 竖屏模式：优化为竖屏游戏体验
           CONFIG.BASE_DISTANCE = Math.max(80, screenWidth * 0.15);
           CONFIG.PLATFORM_WIDTH = Math.max(60, screenWidth * 0.08);
           CONFIG.JUMP_FORCE = 18;
           CONFIG.PLAYER_SIZE = Math.max(40, screenHeight * 0.08);
           CONFIG.GRAVITY = 0.65;
           CONFIG.GROUND_Y = this.logicalHeight * 0.85;
           CONFIG.PERFECT_TOLERANCE = 6;
         }
      } else {
        // 桌面设备：模拟手机横屏体验
        canvasWidth = screenWidth;
        canvasHeight = screenHeight;
        
        // 桌面横屏优化
        if (isLandscape && screenWidth > 1024) {
          CONFIG.BASE_DISTANCE = 160;
          CONFIG.PLATFORM_WIDTH = 120;
          CONFIG.JUMP_FORCE = 22;
          CONFIG.PLAYER_SIZE = 80;
          CONFIG.GRAVITY = 0.7;
        }
      }
    }
    
    // 设置画布尺寸
    this.canvas.width = canvasWidth * dpr;
    this.canvas.height = canvasHeight * dpr;
    
    // 设置CSS尺寸
    this.canvas.style.width = canvasWidth + 'px';
    this.canvas.style.height = canvasHeight + 'px';
    
    // 缩放绘图上下文以适应设备像素比
    this.ctx.scale(dpr, dpr);
    
    // 存储逻辑尺寸供游戏逻辑使用
    this.logicalWidth = canvasWidth;
    this.logicalHeight = canvasHeight;
    
    // 根据屏幕方向调整地面高度
    const isLandscape = canvasWidth > canvasHeight;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile && isLandscape) {
      // 手机横屏：地面位置更低，留出更多游戏空间
      CONFIG.GROUND_Y = this.logicalHeight * 0.85;
    } else if (isLandscape) {
      // 桌面横屏
      CONFIG.GROUND_Y = this.logicalHeight * 0.75;
    } else {
      // 竖屏模式
      CONFIG.GROUND_Y = this.logicalHeight * 0.8;
    }
    
    // 监听窗口大小变化和屏幕方向变化
    this.setupResizeHandler();
  }

  /**
   * 设置窗口大小变化监听
   */
  setupResizeHandler() {
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.handleResize();
      }, 250);
    });
    
    // 监听设备方向变化
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this.handleResize();
      }, 500);
    });
  }
  
  /**
   * 处理窗口大小变化
   */
  handleResize() {
    const oldWidth = this.logicalWidth;
    const oldHeight = this.logicalHeight;
    
    // 重新设置画布
    this.setupCanvas();
    
    // 调整游戏对象位置
    if (this.player && oldWidth && oldHeight) {
      const scaleX = this.logicalWidth / oldWidth;
      const scaleY = this.logicalHeight / oldHeight;
      
      // 调整玩家位置
      this.player.x *= scaleX;
      this.player.y *= scaleY;
      
      // 调整平台位置
      this.platforms.forEach(platform => {
        platform.x *= scaleX;
        platform.y *= scaleY;
      });
      
      // 调整摄像机位置
      this.camera.x *= scaleX;
      this.camera.y *= scaleY;
    }
  }
  
  /**
   * 初始化游戏对象
   */
  initGameObjects() {
    // 创建玩家
    this.player = new Player(
      this.logicalWidth / 2 - CONFIG.PLAYER_SIZE / 2,
      CONFIG.GROUND_Y - CONFIG.PLAYER_SIZE
    );
    
    // 创建初始平台
    this.platforms = [
      new Platform(this.logicalWidth / 2 - CONFIG.PLATFORM_WIDTH / 2, CONFIG.GROUND_Y, PLATFORM_TYPE.NORMAL),
      new Platform(this.logicalWidth / 2 + 150, CONFIG.GROUND_Y, PLATFORM_TYPE.NORMAL)
    ];
    
    // 重置游戏数据
    this.score = 0;
    this.combo = 0;
    this.camera.x = 0;
    this.gameState = GAME_STATE.START;
  }

  /**
   * 绑定事件 - 手机端触摸优化
   */
  bindEvents() {
    // 检测是否为手机设备
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // 绑定触摸事件到canvas
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleTouchStart(e.changedTouches[0]);
    }, { passive: false });
    
    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleTouchEnd(e.changedTouches[0]);
    }, { passive: false });
    
    // 手机端添加触摸移动事件优化
    if (isMobile) {
      this.canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        e.stopPropagation();
      }, { passive: false });
    }
    
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
    
    // 手机端添加震动反馈
    if (isMobile && typeof wx !== 'undefined' && wx.vibrateShort) {
      this.enableVibration = true;
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
      // 手机端震动反馈
      if (this.enableVibration && typeof wx !== 'undefined' && wx.vibrateShort) {
        wx.vibrateShort({ type: 'medium' });
      }
    } else {
      // 普通着陆
      this.combo = 0;
      this.score += 1;
      if (this.audioManager) {
        this.audioManager.playLandingSound();
      }
      // 手机端震动反馈
      if (this.enableVibration && typeof wx !== 'undefined' && wx.vibrateShort) {
        wx.vibrateShort({ type: 'light' });
      }
    }
    
    // 处理特殊平台
    if (platform.type === PLATFORM_TYPE.BONUS) {
      this.score += 5;
      // 奖励平台震动反馈
      if (this.enableVibration && typeof wx !== 'undefined' && wx.vibrateShort) {
        wx.vibrateShort({ type: 'medium' });
      }
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
    
    const targetX = this.player.x - this.logicalWidth / 2;
    this.camera.x += (targetX - this.camera.x) * 0.1;
  }

  /**
   * 生成新平台
   */
  generatePlatforms() {
    const lastPlatform = this.platforms[this.platforms.length - 1];
    const rightmostX = lastPlatform.x;
    
    // 如果最右边的平台距离摄像机不够远，生成新平台
    if (rightmostX < this.camera.x + this.logicalWidth + 200) {
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
    // 手机端震动反馈
    if (this.enableVibration && typeof wx !== 'undefined' && wx.vibrateShort) {
      wx.vibrateShort({ type: 'heavy' });
    }
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
    this.ctx.clearRect(0, 0, this.logicalWidth, this.logicalHeight);
    
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
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.logicalHeight);
    gradient.addColorStop(0, '#87CEEB');  // 天空蓝
    gradient.addColorStop(0.3, '#98FB98'); // 浅绿
    gradient.addColorStop(1, '#228B22');   // 森林绿
    
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(
      this.camera.x - 100, 
      this.camera.y - 100, 
      this.logicalWidth + 200,
      this.logicalHeight + 200
    );
    
    // 绘制白云
    this.renderClouds();
    
    // 绘制远景树木
    this.renderBackgroundTrees();
    
    // 绘制阳光效果
    this.renderSunlight();
    
    // 绘制飞舞的蝴蝶
    this.renderButterflies();
    
    // 绘制飞舞的花朵
    this.renderFlowers();
    
    // 绘制飘落的叶子
    this.renderFloatingLeaves();
    
    // 绘制气泡
    this.renderBubbles();
  }
  
  /**
   * 渲染背景树木
   */
  renderBackgroundTrees() {
    const treeSpacing = 150;
    const startX = Math.floor((this.camera.x - 200) / treeSpacing) * treeSpacing;
    const time = Date.now() * 0.001; // 生长时间因子
    
    for (let x = startX; x < this.camera.x + this.logicalWidth + 200; x += treeSpacing) {
      const treeHeight = 40 + Math.random() * 30;
      // 让树木跟随相机，显示在屏幕底部
      const treeY = this.camera.y + this.logicalHeight - 50;
      
      // 树干
      this.ctx.fillStyle = '#8B4513';
      this.ctx.fillRect(x, treeY - treeHeight * 0.3, 8, treeHeight * 0.3);
      
      // 树冠生长效果 - 基于时间和位置的动态大小
      const growthFactor = 1 + Math.sin(time + x * 0.01) * 0.3; // 生长因子
      const crownRadius = treeHeight * 0.4 * growthFactor;
      const highlightRadius = treeHeight * 0.2 * growthFactor;
      
      // 树冠
      this.ctx.fillStyle = '#228B22';
      this.ctx.beginPath();
      this.ctx.arc(x + 4, treeY - treeHeight * 0.5, crownRadius, 0, Math.PI * 2);
      this.ctx.fill();
      
      // 树冠高光
      this.ctx.fillStyle = '#32CD32';
      this.ctx.beginPath();
      this.ctx.arc(x + 2, treeY - treeHeight * 0.6, highlightRadius, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }
  
  /**
   * 渲染阳光效果
   */
  renderSunlight() {
    // 太阳位置调整，避免与音频按钮重叠
    const sunX = this.logicalWidth - 80;
    const sunY = 120; // 从60调整到120，向下移动60像素
    
    // 太阳
    this.ctx.fillStyle = '#FFD700';
    this.ctx.beginPath();
    this.ctx.arc(sunX, sunY, 25, 0, Math.PI * 2);
    this.ctx.fill();
    
    // 阳光光线
    this.ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
    this.ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI * 2) / 8;
      const startX = sunX + Math.cos(angle) * 35;
      const startY = sunY + Math.sin(angle) * 35;
      const endX = sunX + Math.cos(angle) * 50;
      const endY = sunY + Math.sin(angle) * 50;
      
      this.ctx.beginPath();
      this.ctx.moveTo(startX, startY);
      this.ctx.lineTo(endX, endY);
      this.ctx.stroke();
    }
  }
  
     /**
    * 渲染飘落的叶子 - 优化为上半部分飞舞
    */
   renderFloatingLeaves() {
     const time = Date.now() * 0.0005; // 降低运动速度
    
    // 定义不同类型的树叶颜色
    const leafColors = [
      '#228B22', // 深绿色
      '#32CD32', // 酸橙绿
      '#9ACD32', // 黄绿色
      '#8FBC8F', // 深海绿
      '#90EE90'  // 浅绿色
    ];
    
         // 叶子在屏幕上半部分飞舞（0-50%的区域）
     for (let i = 0; i < 12; i++) {
       const x = this.camera.x + (i * this.logicalWidth / 12) + Math.sin(time + i) * 100;
       const y = this.camera.y + this.logicalHeight * 0.1 + Math.sin(time * 0.8 + i) * (this.logicalHeight * 0.3) + Math.cos(time * 0.6 + i) * 60;
       
       this.ctx.save();
       this.ctx.translate(x, y);
       this.ctx.rotate(time + i);
       
       // 增大叶子尺寸
       const leafScale = 1.5; // 增大1.5倍
       this.ctx.scale(leafScale, leafScale);
      
      // 绘制树叶形状
      this.ctx.fillStyle = leafColors[i % leafColors.length];
      this.ctx.beginPath();
      
      // 绘制树叶轮廓（心形叶子）
      this.ctx.moveTo(0, -10);
      this.ctx.bezierCurveTo(-6, -15, -12, -6, -6, 0);
      this.ctx.bezierCurveTo(-12, 6, -6, 15, 0, 10);
      this.ctx.bezierCurveTo(6, 15, 12, 6, 6, 0);
      this.ctx.bezierCurveTo(12, -6, 6, -15, 0, -10);
      this.ctx.fill();
      
      // 绘制叶脉
      this.ctx.strokeStyle = 'rgba(0, 100, 0, 0.6)';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      // 主叶脉
      this.ctx.moveTo(0, -10);
      this.ctx.lineTo(0, 10);
      // 侧叶脉
      this.ctx.moveTo(-3, -5);
      this.ctx.lineTo(0, 0);
      this.ctx.moveTo(3, -5);
      this.ctx.lineTo(0, 0);
      this.ctx.moveTo(-3, 5);
      this.ctx.lineTo(0, 0);
      this.ctx.moveTo(3, 5);
      this.ctx.lineTo(0, 0);
      this.ctx.stroke();
      
      // 添加叶柄
      this.ctx.strokeStyle = '#8B4513';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(0, 10);
      this.ctx.lineTo(0, 14);
      this.ctx.stroke();
      
      this.ctx.restore();
    }
  }

  /**
   * 渲染白云
   */
  renderClouds() {
    const time = Date.now() * 0.0005; // 慢速移动
    
    for (let i = 0; i < 4; i++) {
      const cloudX = this.camera.x + i * 300 + time * 30 + i * 100;
      const cloudY = 80 + Math.sin(time + i) * 20;
      
      // 绘制云朵
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      
      // 云朵由多个圆形组成
      const cloudParts = [
        { x: cloudX, y: cloudY, radius: 25 },
        { x: cloudX + 20, y: cloudY - 5, radius: 30 },
        { x: cloudX + 45, y: cloudY, radius: 25 },
        { x: cloudX + 25, y: cloudY + 15, radius: 20 },
        { x: cloudX + 10, y: cloudY + 10, radius: 18 }
      ];
      
      cloudParts.forEach(part => {
        this.ctx.beginPath();
        this.ctx.arc(part.x, part.y, part.radius, 0, Math.PI * 2);
        this.ctx.fill();
      });
    }
  }

  /**
   * 渲染气泡 - 优化为下半部分飞舞
   */
     renderBubbles() {
     const time = Date.now() * 0.001; // 降低运动速度
    
    // 定义多种气泡颜色样式
    const bubbleColors = [
      {
        inner: 'rgba(173, 216, 230, 0.9)',
        middle: 'rgba(135, 206, 235, 0.7)',
        outer: 'rgba(135, 206, 235, 0.3)'
      }, // 蓝色气泡
      {
        inner: 'rgba(255, 182, 193, 0.9)',
        middle: 'rgba(255, 105, 180, 0.7)',
        outer: 'rgba(255, 105, 180, 0.3)'
      }, // 粉色气泡
      {
        inner: 'rgba(144, 238, 144, 0.9)',
        middle: 'rgba(50, 205, 50, 0.7)',
        outer: 'rgba(50, 205, 50, 0.3)'
      }, // 绿色气泡
      {
        inner: 'rgba(255, 218, 185, 0.9)',
        middle: 'rgba(255, 165, 0, 0.7)',
        outer: 'rgba(255, 165, 0, 0.3)'
      }, // 橙色气泡
      {
        inner: 'rgba(221, 160, 221, 0.9)',
        middle: 'rgba(147, 112, 219, 0.7)',
        outer: 'rgba(147, 112, 219, 0.3)'
      } // 紫色气泡
    ];
    
    // 气泡在屏幕下半部分飞舞（50-100%的区域）
    for (let i = 0; i < 15; i++) {
      const bubbleX = this.camera.x + (i * this.logicalWidth / 15) + Math.sin(time * 0.8 + i) * 80;
      const bubbleY = this.camera.y + this.logicalHeight * 0.6 + Math.sin(time * 0.6 + i) * (this.logicalHeight * 0.3) + Math.cos(time * 0.4 + i) * 50;
      const bubbleSize = 8 + Math.sin(time * 2 + i) * 4; // 增大气泡尺寸
      
      // 选择气泡颜色
      const colorStyle = bubbleColors[i % bubbleColors.length];
      
      // 气泡渐变效果
      const gradient = this.ctx.createRadialGradient(
        bubbleX, bubbleY, 0,
        bubbleX, bubbleY, bubbleSize
      );
      gradient.addColorStop(0, colorStyle.inner);
      gradient.addColorStop(0.7, colorStyle.middle);
      gradient.addColorStop(1, colorStyle.outer);
      
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(bubbleX, bubbleY, bubbleSize, 0, Math.PI * 2);
      this.ctx.fill();
      
      // 气泡高光
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      this.ctx.beginPath();
      this.ctx.arc(bubbleX - bubbleSize * 0.3, bubbleY - bubbleSize * 0.3, bubbleSize * 0.3, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

     /**
    * 渲染飞舞的蝴蝶 - 优化为上半部分飞舞
    */
   renderButterflies() {
     const time = Date.now() * 0.0015; // 降低运动速度
    
    // 定义多种蝴蝶颜色样式
    const butterflyStyles = [
      { wing: '#FF69B4', accent: '#FFB6C1', spots: '#FFF' }, // 粉色
      { wing: '#9370DB', accent: '#DDA0DD', spots: '#FFF' }, // 紫色
      { wing: '#FF6347', accent: '#FFA07A', spots: '#FFF' }, // 橙红色
      { wing: '#32CD32', accent: '#98FB98', spots: '#FFF' }, // 绿色
      { wing: '#1E90FF', accent: '#87CEEB', spots: '#FFF' }, // 蓝色
      { wing: '#FFD700', accent: '#FFFFE0', spots: '#FF6347' } // 金色
    ];
    
    // 蝴蝶在屏幕上半部分飞舞（0-50%的区域）
    for (let i = 0; i < 10; i++) {
      const butterflyX = this.camera.x + (i * this.logicalWidth / 10) + Math.sin(time + i * 2) * 120;
      const butterflyY = this.camera.y + this.logicalHeight * 0.05 + Math.sin(time * 1.2 + i) * (this.logicalHeight * 0.25) + Math.cos(time * 0.7 + i) * 80;
      
      const wingFlap = Math.sin(time * 8 + i) * 0.3; // 翅膀扇动
      const style = butterflyStyles[i % butterflyStyles.length];
      
      this.ctx.save();
      this.ctx.translate(butterflyX, butterflyY);
      
      // 增大蝴蝶尺寸
      const butterflyScale = 1.3; // 增大1.3倍
      this.ctx.scale(butterflyScale, butterflyScale);
      
      // 蝴蝶身体
      this.ctx.fillStyle = '#8B4513';
      this.ctx.fillRect(-1, -6, 2, 12);
      
      // 蝴蝶触角
      this.ctx.strokeStyle = '#8B4513';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(-1, -6);
      this.ctx.lineTo(-2, -9);
      this.ctx.moveTo(1, -6);
      this.ctx.lineTo(2, -9);
      this.ctx.stroke();
      
      // 左翅膀 - 主色
      this.ctx.fillStyle = style.wing;
      this.ctx.save();
      this.ctx.rotate(wingFlap);
      this.ctx.beginPath();
      this.ctx.ellipse(-6, -2, 4, 3, 0, 0, Math.PI * 2);
      this.ctx.fill();
      
      // 左翅膀 - 副色
      this.ctx.fillStyle = style.accent;
      this.ctx.beginPath();
      this.ctx.ellipse(-4, 2, 3, 2, 0, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
      
      // 右翅膀 - 主色
      this.ctx.fillStyle = style.wing;
      this.ctx.save();
      this.ctx.rotate(-wingFlap);
      this.ctx.beginPath();
      this.ctx.ellipse(6, -2, 4, 3, 0, 0, Math.PI * 2);
      this.ctx.fill();
      
      // 右翅膀 - 副色
      this.ctx.fillStyle = style.accent;
      this.ctx.beginPath();
      this.ctx.ellipse(4, 2, 3, 2, 0, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
      
      // 翅膀斑点
      this.ctx.fillStyle = style.spots;
      this.ctx.beginPath();
      this.ctx.arc(-4, -2, 0.8, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.arc(4, -2, 0.8, 0, Math.PI * 2);
      this.ctx.fill();
      
      // 额外装饰斑点
      if (i % 2 === 0) {
        this.ctx.fillStyle = style.spots;
        this.ctx.beginPath();
        this.ctx.arc(-3, 1, 0.6, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(3, 1, 0.6, 0, Math.PI * 2);
        this.ctx.fill();
      }
      
      this.ctx.restore();
    }
  }
  
  /**
   * 渲染飞舞的花朵 - 优化为上半部分飞舞
   */
     renderFlowers() {
     const time = Date.now() * 0.001; // 降低运动速度
    
    // 定义多种花朵颜色样式
    const flowerStyles = [
      { petal: '#FF69B4', center: '#FFD700' }, // 粉色花朵
      { petal: '#FF1493', center: '#FFA500' }, // 深粉色花朵
      { petal: '#FF6347', center: '#FFFF00' }, // 橙红色花朵
      { petal: '#FF4500', center: '#FFD700' }, // 橙色花朵
      { petal: '#9370DB', center: '#FFFFE0' }, // 紫色花朵
      { petal: '#8A2BE2', center: '#FFD700' }, // 蓝紫色花朵
      { petal: '#32CD32', center: '#FFFF00' }, // 绿色花朵
      { petal: '#00FF7F', center: '#FFA500' }, // 春绿色花朵
      { petal: '#1E90FF', center: '#FFD700' }, // 蓝色花朵
      { petal: '#00BFFF', center: '#FFFFE0' }, // 深天蓝花朵
      { petal: '#FFD700', center: '#FF6347' }, // 金色花朵
      { petal: '#FFA500', center: '#FF1493' }  // 橙色花朵
    ];
    
    // 花朵在屏幕上半部分飞舞（0-50%的区域）
    for (let i = 0; i < 8; i++) {
      const flowerX = this.camera.x + (i * this.logicalWidth / 8) + Math.sin(time + i * 1.5) * 150;
      const flowerY = this.camera.y + this.logicalHeight * 0.15 + Math.sin(time * 1.1 + i * 0.8) * (this.logicalHeight * 0.2) + Math.cos(time * 0.5 + i * 1.2) * 100;
      
      const rotation = time * 2 + i * 0.5; // 花朵旋转
      const baseScale = 0.8; // 增大基础尺寸
      const scale = baseScale + Math.sin(time * 3 + i) * 0.15; // 花朵大小变化
      const style = flowerStyles[i % flowerStyles.length];
      
      this.ctx.save();
      this.ctx.translate(flowerX, flowerY);
      this.ctx.rotate(rotation);
      this.ctx.scale(scale, scale);
      
      // 绘制花瓣（5片花瓣）
      this.ctx.fillStyle = style.petal;
      for (let petal = 0; petal < 5; petal++) {
        this.ctx.save();
        this.ctx.rotate((petal * Math.PI * 2) / 5);
        
        // 花瓣形状
        this.ctx.beginPath();
        this.ctx.ellipse(0, -6, 3, 6, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.restore();
      }
      
      // 绘制花心
      this.ctx.fillStyle = style.center;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 2, 0, Math.PI * 2);
      this.ctx.fill();
      
      // 绘制花心细节
      this.ctx.fillStyle = '#8B4513';
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 0.8, 0, Math.PI * 2);
      this.ctx.fill();
      
      this.ctx.restore();
    }
  }
  
  /**
   * 渲染UI界面 - 手机端优化
   */
  renderUI() {
    // 检测是否为手机设备
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isLandscape = this.logicalWidth > this.logicalHeight;
    
    // 根据设备类型调整字体大小
    const scoreFontSize = isMobile ? (isLandscape ? 28 : 24) : 24;
    const comboFontSize = isMobile ? (isLandscape ? 22 : 20) : 20;
    const tipFontSize = isMobile ? (isLandscape ? 18 : 16) : 20;
    
         // 分数显示位置调整 - 手机端优化
     this.ctx.fillStyle = '#333';
     this.ctx.font = `bold ${scoreFontSize}px Arial`;
     
     // 手机端将分数显示向左移动，避免与蓄力长条重叠
     const scoreX = isMobile ? (isLandscape ? 15 : 8) : 20;
     this.ctx.fillText(`分数: ${this.score}`, scoreX, 120);
     
     if (this.combo > 0) {
       this.ctx.fillStyle = '#FF6B6B';
       this.ctx.font = `bold ${comboFontSize}px Arial`;
       this.ctx.fillText(`连击: ${this.combo}`, scoreX, 150);
     }
    
         // 显示游戏状态和提示 - 手机端优化位置
     const tipY = isMobile ? (isLandscape ? this.logicalHeight - 60 : this.logicalHeight - 80) : this.logicalHeight - 40;
    
    if (this.gameState === GAME_STATE.START) {
      this.ctx.fillStyle = '#666';
      this.ctx.font = `${tipFontSize}px Arial`;
      this.ctx.fillText('点击屏幕开始蓄力跳跃', 20, tipY);
    } else if (this.gameState === GAME_STATE.CHARGING) {
      this.ctx.fillStyle = '#FF6B6B';
      this.ctx.font = `${tipFontSize}px Arial`;
      this.ctx.fillText('蓄力中... 松开跳跃', 20, tipY);
    }
  }

     /**
    * 渲染蓄力指示器 - 手机端优化
    */
   renderChargeIndicator() {
     // 检测是否为手机设备
     const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
     const isLandscape = this.logicalWidth > this.logicalHeight;
     
     // 根据设备类型调整指示器大小
     const barWidth = isMobile ? (isLandscape ? 220 : 180) : 200; // 缩短手机端蓄力长条
     const barHeight = isMobile ? (isLandscape ? 25 : 20) : 20;
     
     // 手机端将蓄力长条调整位置，避免与分数重叠且不超出边界
     let x;
     if (isMobile) {
       if (isLandscape) {
         // 横屏模式：适度向右移动，确保不超出边界
         const minOffset = 60; // 减少最小偏移量
         const dynamicOffset = this.logicalWidth * 0.05; // 减少动态偏移量
         const maxX = this.logicalWidth - barWidth - 20; // 确保不超出右边界
         x = Math.min((this.logicalWidth - barWidth) / 2 + Math.max(minOffset, dynamicOffset), maxX);
       } else {
         // 竖屏模式：适度向右移动，确保不超出边界
         const minOffset = 70; // 减少最小偏移量
         const dynamicOffset = this.logicalWidth * 0.08; // 减少动态偏移量
         const maxX = this.logicalWidth - barWidth - 15; // 确保不超出右边界
         x = Math.min((this.logicalWidth - barWidth) / 2 + Math.max(minOffset, dynamicOffset), maxX);
       }
     } else {
       // 桌面模式：居中显示
       x = (this.logicalWidth - barWidth) / 2;
     }
     
     const y = isMobile ? (isLandscape ? 120 : 140) : 100;
    
    // 背景
    this.ctx.fillStyle = 'rgba(221, 221, 221, 0.8)';
    this.ctx.fillRect(x, y, barWidth, barHeight);
    
    // 蓄力条
    const fillWidth = (this.chargePower / CONFIG.MAX_POWER) * barWidth;
    this.ctx.fillStyle = this.chargePower > 0.8 ? '#FF4444' : '#4CAF50';
    this.ctx.fillRect(x, y, fillWidth, barHeight);
    
    // 边框
    this.ctx.strokeStyle = '#333';
    this.ctx.lineWidth = isMobile ? 3 : 2;
    this.ctx.strokeRect(x, y, barWidth, barHeight);
    
    // 手机端添加蓄力百分比显示
    if (isMobile) {
      const percentage = Math.round((this.chargePower / CONFIG.MAX_POWER) * 100);
      this.ctx.fillStyle = '#333';
      this.ctx.font = `${isLandscape ? 16 : 14}px Arial`;
      this.ctx.textAlign = 'center';
      this.ctx.fillText(`${percentage}%`, x + barWidth / 2, y + barHeight + 20);
      this.ctx.textAlign = 'left';
    }
  }

  /**
   * 渲染游戏结束界面 - 手机端优化
   */
  renderGameOver() {
    // 检测是否为手机设备
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isLandscape = this.logicalWidth > this.logicalHeight;
    
    // 半透明遮罩
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
    
    // 在遮罩上方继续显示气泡
    this.ctx.save();
    this.ctx.translate(-this.camera.x, -this.camera.y);
    this.renderBubbles();
    this.ctx.restore();
    
    // 根据设备类型调整字体大小
    const titleFontSize = isMobile ? (isLandscape ? 42 : 36) : 48;
    const scoreFontSize = isMobile ? (isLandscape ? 28 : 24) : 32;
    const tipFontSize = isMobile ? (isLandscape ? 20 : 18) : 24;
    
    // 游戏结束文字
    this.ctx.fillStyle = 'white';
    this.ctx.font = `bold ${titleFontSize}px Arial`;
    this.ctx.textAlign = 'center';
    this.ctx.fillText('游戏结束', this.logicalWidth / 2, this.logicalHeight / 2 - 50);
    
    this.ctx.font = `bold ${scoreFontSize}px Arial`;
    this.ctx.fillText(`最终分数: ${this.score}`, this.logicalWidth / 2, this.logicalHeight / 2);
    
    this.ctx.font = `${tipFontSize}px Arial`;
    this.ctx.fillText('点击屏幕重新开始', this.logicalWidth / 2, this.logicalHeight / 2 + 50);
    
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
    this.squirrelImage = null;
    this.loadSquirrelImage();
  }

     loadSquirrelImage() {
     // 检查环境是否支持Image构造函数
     if (typeof Image !== 'undefined') {
       this.squirrelImage = new Image();
       this.squirrelImage.onload = () => {
         console.log('松鼠图像加载成功');
       };
       this.squirrelImage.onerror = () => {
         console.warn('松鼠图像加载失败，使用备用渲染');
         this.squirrelImage = null;
       };
       this.squirrelImage.src = 'images/squirrel.svg';
     } else {
       console.warn('Image构造函数不可用，使用备用渲染');
       this.squirrelImage = null;
     }
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
    if (this.squirrelImage && this.squirrelImage.complete) {
      // 使用SVG图片渲染松鼠
      ctx.drawImage(
        this.squirrelImage,
        this.x,
        this.y,
        this.size,
        this.size
      );
    } else {
      // 图片未加载完成时的备用渲染
      ctx.fillStyle = CONFIG.PLAYER_COLOR;
      ctx.fillRect(this.x, this.y, this.size, this.size);
      
      // 简单的松鼠形状作为备用
      ctx.fillStyle = '#CD853F';
      ctx.beginPath();
      ctx.arc(this.x + this.size/2, this.y + this.size/2, this.size/3, 0, Math.PI * 2);
      ctx.fill();
    }
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
    // 所有平台使用统一的草地样式
    this.renderGrassland(ctx);
    
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
    
    // 绘制小树苗（移除绿色圆圈叶子装饰）
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