/**
 * 音频管理器
 * 负责游戏中的背景音乐和音效播放
 */
class AudioManager {
  constructor() {
    this.audioContext = null;
    this.backgroundMusic = null;
    this.isBackgroundMusicPlaying = false;
    this.volume = 0.5;
    this.soundEnabled = true;
    
    // 初始化音频上下文
    this.initAudioContext();
  }
  
  /**
   * 初始化音频上下文
   */
  initAudioContext() {
    try {
      // 浏览器环境
      if (typeof window !== 'undefined') {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          this.audioContext = new AudioContextClass();
          console.log('AudioContext created successfully, state:', this.audioContext.state);
        } else {
          console.warn('AudioContext not supported in this browser');
          this.soundEnabled = false;
        }
      }
      // 微信小游戏环境
      else if (typeof wx !== 'undefined' && wx.createWebAudioContext) {
        this.audioContext = wx.createWebAudioContext();
        console.log('WeChat AudioContext created successfully');
      } else {
        console.warn('No audio context available');
        this.soundEnabled = false;
      }
    } catch (e) {
      console.error('Failed to create AudioContext:', e);
      this.soundEnabled = false;
    }
  }
  
  /**
   * 恢复音频上下文（用户交互后）
   */
  async resumeAudioContext() {
    if (this.audioContext) {
      console.log('AudioContext state before resume:', this.audioContext.state);
      if (this.audioContext.state === 'suspended') {
        try {
          await this.audioContext.resume();
          console.log('AudioContext resumed successfully, new state:', this.audioContext.state);
        } catch (e) {
          console.error('Failed to resume AudioContext:', e);
        }
      } else {
        console.log('AudioContext is already running');
      }
    } else {
      console.warn('No AudioContext available to resume');
    }
  }
  
  /**
   * 播放着地音效
   */
  playLandingSound() {
    if (!this.soundEnabled || !this.audioContext) return;
    
    try {
      // 创建振荡器
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      // 连接节点
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      // 设置音效参数（着地音效）
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 0.1);
      
      // 设置音量包络
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(this.volume * 0.3, this.audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.15);
      
      // 播放音效
      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + 0.15);
    } catch (e) {
      console.warn('Failed to play landing sound:', e);
    }
  }
  
  /**
   * 播放跳跃音效
   */
  playJumpSound() {
    if (!this.soundEnabled || !this.audioContext) return;
    
    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      // 设置跳跃音效参数
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(300, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(600, this.audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(this.volume * 0.2, this.audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.1);
      
      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + 0.1);
    } catch (e) {
      console.warn('Failed to play jump sound:', e);
    }
  }
  
  /**
   * 播放完美着陆音效
   */
  playPerfectLandingSound() {
    if (!this.soundEnabled || !this.audioContext) return;
    
    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      // 设置完美着陆音效参数（更高音调）
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(400, this.audioContext.currentTime);
      oscillator.frequency.linearRampToValueAtTime(800, this.audioContext.currentTime + 0.1);
      oscillator.frequency.linearRampToValueAtTime(600, this.audioContext.currentTime + 0.2);
      
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(this.volume * 0.4, this.audioContext.currentTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(this.volume * 0.2, this.audioContext.currentTime + 0.1);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.25);
      
      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + 0.25);
    } catch (e) {
      console.warn('Failed to play perfect landing sound:', e);
    }
  }
  
  /**
   * 播放游戏结束音效
   */
  playGameOverSound() {
    if (!this.soundEnabled || !this.audioContext) return;
    
    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      // 设置游戏结束音效参数（下降音调）
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(300, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 0.5);
      
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(this.volume * 0.3, this.audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.5);
      
      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + 0.5);
    } catch (e) {
      console.warn('Failed to play game over sound:', e);
    }
  }
  
  /**
   * 开始播放背景音乐
   */
  startBackgroundMusic() {
    if (!this.soundEnabled || !this.audioContext || this.isBackgroundMusicPlaying) {
      return;
    }
    
    this.isBackgroundMusicPlaying = true;
    this.playBackgroundMusicLoop();
  }
  
  /**
   * 停止背景音乐
   */
  stopBackgroundMusic() {
    this.isBackgroundMusicPlaying = false;
    if (this.backgroundMusic) {
      this.backgroundMusic.stop();
      this.backgroundMusic = null;
    }
  }
  
  /**
   * 播放背景音乐循环 - 流行游戏音乐
   */
  playBackgroundMusicLoop() {
    if (!this.isBackgroundMusicPlaying || !this.audioContext) {
      return;
    }
    
    try {
      // 流行游戏音乐旋律 - 动感节拍
      const melodyPattern = [
        // 第一小节 - 上升旋律
        {freq: 523.25, duration: 0.3, delay: 0},    // C5
        {freq: 587.33, duration: 0.3, delay: 0.3},  // D5
        {freq: 659.25, duration: 0.4, delay: 0.6},  // E5
        {freq: 698.46, duration: 0.5, delay: 1.0},  // F5
        
        // 第二小节 - 下降旋律
        {freq: 659.25, duration: 0.3, delay: 1.5},  // E5
        {freq: 587.33, duration: 0.3, delay: 1.8},  // D5
        {freq: 523.25, duration: 0.4, delay: 2.1},  // C5
        {freq: 493.88, duration: 0.5, delay: 2.5},  // B4
      ];
      
      // 低音节拍
      const bassPattern = [
        {freq: 130.81, duration: 0.8, delay: 0},    // C3
        {freq: 146.83, duration: 0.8, delay: 0.8},  // D3
        {freq: 164.81, duration: 0.8, delay: 1.6},  // E3
        {freq: 174.61, duration: 0.8, delay: 2.4},  // F3
      ];
      
      const currentTime = this.audioContext.currentTime;
      
      // 播放主旋律
      melodyPattern.forEach(note => {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.type = 'square'; // 使用方波，更有电子游戏感
        oscillator.frequency.setValueAtTime(note.freq, currentTime + note.delay);
        
        const startTime = currentTime + note.delay;
        const volume = this.volume * 0.05;
        
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.05);
        gainNode.gain.linearRampToValueAtTime(volume * 0.8, startTime + note.duration * 0.7);
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + note.duration);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + note.duration);
      });
      
      // 播放低音节拍
      bassPattern.forEach(note => {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.type = 'sawtooth'; // 使用锯齿波作为低音
        oscillator.frequency.setValueAtTime(note.freq, currentTime + note.delay);
        
        const startTime = currentTime + note.delay;
        const volume = this.volume * 0.03;
        
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.1);
        gainNode.gain.linearRampToValueAtTime(volume * 0.5, startTime + note.duration * 0.8);
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + note.duration);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + note.duration);
      });
      
      // 3.2秒后播放下一个循环
      setTimeout(() => {
        if (this.isBackgroundMusicPlaying) {
          this.playBackgroundMusicLoop();
        }
      }, 3200);
      
    } catch (e) {
      console.warn('Failed to play background music:', e);
    }
  }

  
  /**
   * 设置音量
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
  }
  
  /**
   * 切换音效开关
   */
  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    console.log('音频状态切换为:', this.soundEnabled ? '启用' : '禁用');
    
    if (!this.soundEnabled) {
      // 禁用音频时停止所有音效
      this.stopBackgroundMusic();
      
      // 如果有正在播放的音效，也要停止
      if (this.audioContext) {
        try {
          // 暂停音频上下文以停止所有音效
          if (this.audioContext.state === 'running') {
            this.audioContext.suspend();
          }
        } catch (e) {
          console.warn('Failed to suspend audio context:', e);
        }
      }
    } else {
      // 启用音频时恢复音频上下文
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(e => {
          console.warn('Failed to resume audio context:', e);
        });
      }
    }
    
    return this.soundEnabled;
  }
}

// 导出音频管理器
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AudioManager;
} else {
  window.AudioManager = AudioManager;
}