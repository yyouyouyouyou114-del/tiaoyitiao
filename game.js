// 跳一跳游戏入口文件

// 初始化全局对象
GameGlobal.canvas = wx.createCanvas();

// 导入音频管理器
const AudioManager = require('./js/audio_manager.js').default;

// 导入游戏主类
const JumpGame = require('./js/jump_game.js').default;

// 创建游戏实例
const game = new JumpGame();

// 启动游戏
game.init();