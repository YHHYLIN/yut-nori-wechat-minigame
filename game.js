// 微信小游戏 - 掷柶（在线对战版 + 胜利烟花）
const canvas = wx.createCanvas();
const ctx = canvas.getContext('2d');

// 屏幕适配
const sysInfo = wx.getSystemInfoSync();
const screenWidth = sysInfo.windowWidth;
const screenHeight = sysInfo.windowHeight;
const dpr = sysInfo.pixelRatio || 1;
canvas.width = screenWidth * dpr;
canvas.height = screenHeight * dpr;
ctx.scale(dpr, dpr);

// ==================== 网络配置 ====================
const NetworkConfig = {
    // 本地调试：使用电脑局域网IP（cmd输入ipconfig查看）
    WS_URL: 'ws://192.168.1.5:3000',
    // 生产环境：wss://你的域名/ws
    RECONNECT_INTERVAL: 3000,
    MAX_RECONNECT: 5
};

// ==================== 烟花系统 ====================
const FireworkSystem = {
    fireworks: [],
    particles: [],
    isPlaying: false,
    launchInterval: null,
    
    start() {
        this.isPlaying = true;
        this.fireworks = [];
        this.particles = [];
        this.launchInterval = setInterval(() => {
            if (this.fireworks.length < 3) this.launch();
        }, 600);
        
        // 播放胜利音效
        AudioSys.play('win');
        
        // 持续庆祝10秒后自动停止
        setTimeout(() => this.stop(), 10000);
    },
    
    stop() {
        this.isPlaying = false;
        if (this.launchInterval) clearInterval(this.launchInterval);
        this.fireworks = [];
        this.particles = [];
    },
    
    launch() {
        const x = Math.random() * screenWidth;
        const y = screenHeight;
        const targetY = screenHeight * 0.2 + Math.random() * screenHeight * 0.3;
        const colors = ['#ff6b6b', '#4dabf7', '#ffd700', '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2ff'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        this.fireworks.push({
            x, y, targetY, color,
            speed: 8 + Math.random() * 4,
            trail: []
        });
    },
    
    update() {
        if (!this.isPlaying) return;
        
        // 更新烟花上升
        for (let i = this.fireworks.length - 1; i >= 0; i--) {
            const fw = this.fireworks[i];
            fw.trail.push({x: fw.x, y: fw.y});
            if (fw.trail.length > 10) fw.trail.shift();
            fw.y -= fw.speed;
            
            if (fw.y <= fw.targetY) {
                this.explode(fw.x, fw.y, fw.color);
                this.fireworks.splice(i, 1);
            }
        }
        
        // 更新粒子
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.15;
            p.life -= 0.015;
            p.alpha = p.life;
            if (p.life <= 0) this.particles.splice(i, 1);
        }
    },
    
    explode(x, y, color) {
        const particleCount = 30 + Math.random() * 20;
        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 / particleCount) * i + Math.random() * 0.5;
            const speed = 2 + Math.random() * 4;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color,
                life: 1,
                alpha: 1
            });
        }
        AudioSys.play('firework');
    },
    
    draw(ctx) {
        if (!this.isPlaying) return;
        
        ctx.save();
        // 绘制烟花轨迹
        this.fireworks.forEach(fw => {
            ctx.beginPath();
            ctx.strokeStyle = fw.color;
            ctx.lineWidth = 2;
            fw.trail.forEach((point, i) => {
                if (i === 0) ctx.moveTo(point.x, point.y);
                else ctx.lineTo(point.x, point.y);
            });
            ctx.lineTo(fw.x, fw.y);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.arc(fw.x, fw.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
        });
        
        // 绘制粒子
        this.particles.forEach(p => {
            ctx.globalAlpha = p.alpha;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.fill();
            
            ctx.beginPath();
            ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.alpha * 0.3;
            ctx.fill();
        });
        ctx.restore();
    }
};

// ==================== 音频系统 ====================
const AudioSys = {
    ctx: null,
    bgmInterval: null,
    
    init() {
        try {
            const AudioContext = wx.createInnerAudioContext ? wx.createInnerAudioContext : (typeof AudioContext !== 'undefined' ? AudioContext : null);
            if (AudioContext) {
                this.ctx = typeof AudioContext === 'function' ? new AudioContext() : AudioContext;
            }
        } catch(e) {}
    },
    
    playTone(freq, duration) {
        if (!this.ctx) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.frequency.value = freq;
            osc.start();
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
            osc.stop(this.ctx.currentTime + duration);
        } catch(e) {}
    },
    
    playBGM() {
        if (this.bgmInterval) clearInterval(this.bgmInterval);
    },
    
    stopBGM() {
        if (this.bgmInterval) clearInterval(this.bgmInterval);
    },
    
    play(type) {
        switch(type) {
            case 'select': this.playTone(523, 0.1); break;
            case 'throw': 
                this.playTone(440, 0.05);
                setTimeout(() => this.playTone(554, 0.05), 50);
                break;
            case 'move': this.playTone(392, 0.15); break;
            case 'catch': 
                this.playTone(523, 0.2);
                setTimeout(() => this.playTone(659, 0.2), 50);
                break;
            case 'win':
                [440, 494, 523, 494, 440, 392].forEach((freq, i) => {
                    setTimeout(() => this.playTone(freq, 0.3), i * 200);
                });
                break;
            case 'firework':
                this.playTone(800 + Math.random() * 400, 0.1);
                break;
        }
    }
};
AudioSys.init();

// ==================== 联机管理器 ====================
const OnlineManager = {
    ws: null,
    isConnected: false,
    roomId: null,
    playerId: null,
    isHost: false,
    matchStatus: 'idle',
    reconnectCount: 0,
    
    init() {
        this.playerId = wx.getStorageSync('playerId') || ('player_' + Date.now());
        wx.setStorageSync('playerId', this.playerId);
    },
    
    connect() {
        if (this.ws && this.ws.readyState === 1) return;
        
        this.matchStatus = 'connecting';
        Game.updateHint('连接服务器...');
        
        try {
            this.ws = wx.connectSocket({
                url: NetworkConfig.WS_URL,
                protocols: ['websocket']
            });
            
            this.ws.onOpen(() => {
                console.log('WebSocket已连接');
                this.isConnected = true;
                this.reconnectCount = 0;
                this.startMatch();
            });
            
            this.ws.onMessage((res) => {
                const data = JSON.parse(res.data);
                this.handleMessage(data);
            });
            
            this.ws.onClose(() => {
                this.isConnected = false;
                this.attemptReconnect();
            });
            
            this.ws.onError((err) => {
                console.error('WebSocket错误:', err);
                Game.updateHint('连接失败');
            });
            
        } catch (err) {
            console.error('连接失败:', err);
        }
    },
    
    attemptReconnect() {
        if (this.reconnectCount < NetworkConfig.MAX_RECONNECT) {
            this.reconnectCount++;
            Game.updateHint(`重新连接(${this.reconnectCount})...`);
            setTimeout(() => this.connect(), NetworkConfig.RECONNECT_INTERVAL);
        } else {
            wx.showModal({
                title: '连接失败',
                content: '无法连接到服务器，是否切换到单机模式？',
                success: (res) => {
                    if (res.confirm) Game.setMode('pvp');
                }
            });
        }
    },
    
    startMatch() {
        this.matchStatus = 'waiting';
        this.send({ type: 'join', playerId: this.playerId });
    },
    
    joinRoom(roomId) {
        this.matchStatus = 'connecting';
        this.send({ type: 'join', playerId: this.playerId, roomId });
    },
    
    send(data) {
        if (this.ws && this.ws.readyState === 1) {
            this.ws.send({ data: JSON.stringify(data) });
        }
    },
    
    handleMessage(data) {
        switch(data.type) {
            case 'waiting': Game.updateHint('等待其他玩家...'); break;
            case 'matched':
                this.roomId = data.roomId;
                this.isHost = data.isHost;
                this.matchStatus = 'matched';
                Game.updateHint('匹配成功！');
                break;
            case 'joined':
                this.roomId = data.roomId;
                this.isHost = data.isHost;
                Game.updateHint('已加入房间');
                break;
            case 'gameStart':
                this.matchStatus = 'playing';
                Game.startOnlineGame(this.isHost);
                break;
            case 'opponentAction':
                Game.handleOpponentAction(data.action);
                break;
            case 'opponentLeft':
                wx.showModal({
                    title: '对手离开',
                    content: '对方已断开',
                    success: () => {
                        this.disconnect();
                        Game.setMode('pvp');
                    }
                });
                break;
        }
    },
    
    sendGameAction(action) {
        this.send({ type: 'gameAction', action });
    },
    
    disconnect() {
        if (this.ws) {
            this.send({ type: 'leave' });
            this.ws.close();
        }
        this.reset();
    },
    
    reset() {
        this.ws = null;
        this.isConnected = false;
        this.roomId = null;
        this.isHost = false;
        this.matchStatus = 'idle';
        this.reconnectCount = 0;
    }
};

// ==================== 游戏常量 ====================
const PATHS = {
    outer: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
    diag1: [5, 20, 21, 22, 23, 24, 15],
    diag2: [10, 25, 26, 22, 27, 28, 0]
};

const SPOTS = {
    0: {x: 550, y: 550, name: '起点'}, 1: {x: 550, y: 450, name: '右1'},
    2: {x: 550, y: 350, name: '右2'}, 3: {x: 550, y: 250, name: '右3'},
    4: {x: 550, y: 150, name: '右4'}, 5: {x: 550, y: 50, name: '右上'},
    6: {x: 450, y: 50, name: '上6'}, 7: {x: 350, y: 50, name: '上7'},
    8: {x: 250, y: 50, name: '上8'}, 9: {x: 150, y: 50, name: '上9'},
    10: {x: 50, y: 50, name: '左上'}, 11: {x: 50, y: 150, name: '左11'},
    12: {x: 50, y: 250, name: '左12'}, 13: {x: 50, y: 350, name: '左13'},
    14: {x: 50, y: 450, name: '左14'}, 15: {x: 50, y: 550, name: '左下'},
    16: {x: 150, y: 550, name: '下16'}, 17: {x: 250, y: 550, name: '下17'},
    18: {x: 350, y: 550, name: '下18'}, 19: {x: 450, y: 550, name: '下19'},
    20: {x: 483, y: 117, name: '副1'}, 21: {x: 417, y: 183, name: '副2'},
    22: {x: 300, y: 300, name: '中心'}, 23: {x: 183, y: 417, name: '副3'},
    24: {x: 117, y: 483, name: '副4'}, 25: {x: 117, y: 117, name: '主1'},
    26: {x: 183, y: 183, name: '主2'}, 27: {x: 417, y: 417, name: '主3'},
    28: {x: 483, y: 483, name: '主4'}
};

function toScreen(x, y, boardX, boardY, scale) {
    return {
        x: boardX + (x / 600) * scale,
        y: boardY + (y / 600) * scale
    };
}

function drawRoundRect(ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

// ==================== 游戏主对象 ====================
const Game = {
    mode: 'pvp',
    current: 'A',
    pieces: { A: [], B: [] },
    nest: { A: [0,1,2,3], B: [0,1,2,3] },
    finished: { A: 0, B: 0 },
    moves: [],
    animating: false,
    selectedPieces: [],
    possibleTargets: [],
    lastResult: null,
    hintText: '点击「掷柶」开始',
    buttons: [],
    flashTimer: 0,
    gameOver: false,
    
    sticks: Array(4).fill(null).map(() => ({ angle: 0, color: '#8B4513', targetColor: '#8B4513', isHalf: false })),
    isThrowing: false,
    throwAnimationFrame: 0,
    
    layout: { boardSize: 0, boardX: 0, boardY: 0, leftPanelW: 130, rightPanelW: 130 },

    init() {
        this.calculateLayout();
        this.setupTouch();
        this.restart();
        OnlineManager.init();
        this.startGameLoop();
    },

    calculateLayout() {
        this.layout.leftPanelW = 130;
        this.layout.rightPanelW = 130;
        const availableWidth = screenWidth - this.layout.leftPanelW - this.layout.rightPanelW - 20;
        const availableHeight = screenHeight - 60;
        this.layout.boardSize = Math.min(availableWidth, availableHeight, 600);
        this.layout.boardX = this.layout.leftPanelW + 10 + (availableWidth - this.layout.boardSize) / 2;
        this.layout.boardY = (screenHeight - this.layout.boardSize) / 2;
    },

    draw() {
        this.buttons = [];
        this.flashTimer = Date.now() % 1000 / 1000;
        
        // 背景
        const gradient = ctx.createLinearGradient(0, 0, screenWidth, screenHeight);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(1, '#16213e');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, screenWidth, screenHeight);
        
        // 烟花
        FireworkSystem.update();
        FireworkSystem.draw(ctx);
        
        this.drawLeftPanel();
        this.drawRightPanel();
        this.drawBoard();
        this.drawPieces();
        this.drawHints();
        this.drawUI();
        
        if (this.isThrowing) this.updateThrowAnimation();
    },

    drawLeftPanel() {
        const x = 10, w = this.layout.leftPanelW - 20;
        let y = 20;
        const h = (screenHeight - 50) / 4;
        
        ['甲方出发', '乙方出发', '甲方完成', '乙方完成'].forEach((title, i) => {
            const player = i % 2 === 0 ? 'A' : 'B';
            const isFinish = i >= 2;
            this.drawPanelBox(x, y, w, h - 10, i < 2 ? (i===0?'#ffebee':'#e3f2fd') : (i===2?'#e8f5e9':'#e3f2fd'), title, i===0||i===2?'#c62828':'#1565c0');
            if (!isFinish) this.drawNestSlots(x + 10, y + 30, w - 20, h - 40, player);
            else this.drawFinishSlots(x + 10, y + 30, w - 20, h - 40, player);
            y += h;
        });
    },

    drawPanelBox(x, y, w, h, bgColor, title, titleColor) {
        ctx.fillStyle = bgColor;
        drawRoundRect(ctx, x, y, w, h, 8);
        ctx.fill();
        ctx.strokeStyle = 'rgba(139, 69, 19, 0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.fillStyle = titleColor;
        ctx.font = 'bold 14px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.fillText(title, x + w/2, y + 20);
    },

    drawNestSlots(x, y, w, h, player) {
        const slots = this.nest[player];
        const cellW = w / 2, cellH = h / 2;
        
        for (let i = 0; i < 4; i++) {
            const row = Math.floor(i / 2), col = i % 2;
            const cx = x + col * cellW + cellW/2;
            const cy = y + row * cellH + cellH/2;
            const r = Math.min(cellW, cellH) * 0.4;
            
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fillStyle = '#f0f0f0';
            ctx.fill();
            ctx.strokeStyle = '#bbb';
            ctx.setLineDash([2, 2]);
            ctx.stroke();
            ctx.setLineDash([]);
            
            if (slots.includes(i)) {
                const isSelected = this.selectedPieces.some(p => p.pl === player && p.idx === i);
                this.drawCirclePiece(cx, cy, r * 0.9, player === 'A' ? '#ff6b6b' : '#4dabf7', i + 1, isSelected);
                this.addButton(cx - r, cy - r, r * 2, r * 2, () => {
                    AudioSys.play('select');
                    this.onPieceClick(player, i);
                }, 'nest-piece', { player, idx: i });
            }
        }
    },

    drawFinishSlots(x, y, w, h, player) {
        const count = this.pieces[player].filter(p => p.done).length;
        const cellW = w / 2, cellH = h / 2;
        
        for (let i = 0; i < 4; i++) {
            const row = Math.floor(i / 2), col = i % 2;
            const cx = x + col * cellW + cellW/2;
            const cy = y + row * cellH + cellH/2;
            
            ctx.beginPath();
            ctx.arc(cx, cy, Math.min(cellW, cellH) * 0.4, 0, Math.PI * 2);
            ctx.fillStyle = i < count ? '#fff' : '#f5f5f5';
            ctx.fill();
            ctx.strokeStyle = i < count ? '#666' : '#ccc';
            ctx.stroke();
            
            if (i < count) {
                this.drawCirclePiece(cx, cy, Math.min(cellW, cellH) * 0.35, player === 'A' ? '#ff6b6b' : '#4dabf7', i + 1, false);
            }
        }
    },

    drawRightPanel() {
        const x = screenWidth - this.layout.rightPanelW + 10;
        let y = 20;
        const w = this.layout.rightPanelW - 20;
        
        // 模式按钮
        const modes = ['pvp', 'ai', 'online'];
        const labels = ['双人', '人机', '在线'];
        modes.forEach((m, i) => {
            this.drawButton(x + (w/3 + 2) * i, y, w/3 - 4, 30, this.mode === m ? '#8b4513' : '#fff', labels[i], this.mode === m);
            this.addButton(x + (w/3 + 2) * i, y, w/3 - 4, 30, () => this.setMode(m), `mode-${m}`);
        });
        y += 40;
        
        // 在线状态
        if (this.mode === 'online') {
            ctx.fillStyle = 'white';
            drawRoundRect(ctx, x, y, w, 50, 8);
            ctx.fill();
            ctx.fillStyle = OnlineManager.matchStatus === 'playing' ? '#27ae60' : '#f39c12';
            ctx.font = 'bold 13px Microsoft YaHei';
            ctx.textAlign = 'center';
            
            let statusText = '点击匹配';
            if (OnlineManager.matchStatus === 'connecting') statusText = '连接中...';
            else if (OnlineManager.matchStatus === 'waiting') statusText = '等待对手...';
            else if (OnlineManager.matchStatus === 'playing') statusText = '对战中';
            
            ctx.fillText(statusText, x + w/2, y + 20);
            
            if (OnlineManager.matchStatus !== 'playing') {
                this.drawButton(x + 5, y + 28, w - 10, 20, '#27ae60', OnlineManager.matchStatus === 'waiting' ? '取消' : '匹配', false);
                this.addButton(x + 5, y + 28, w - 10, 20, () => {
                    if (OnlineManager.matchStatus === 'waiting') OnlineManager.disconnect();
                    else OnlineManager.connect();
                }, 'match-btn');
            }
            y += 60;
        }
        
        // 回合信息
        ctx.fillStyle = 'white';
        drawRoundRect(ctx, x, y, w, 60, 8);
        ctx.fill();
        ctx.fillStyle = this.current === 'A' ? '#c62828' : '#1565c0';
        ctx.font = 'bold 16px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.fillText(`${this.current === 'A' ? '🔴 甲方' : '🔵 乙方'}回合`, x + w/2, y + 25);
        ctx.fillStyle = '#666';
        ctx.font = '13px Microsoft YaHei';
        ctx.fillText(`甲:${this.finished.A}/4 | 乙:${this.finished.B}/4`, x + w/2, y + 48);
        y += 70;
        
        // 掷柶区域
        const yutH = 140;
        const grad = ctx.createLinearGradient(x, y, x, y + yutH);
        grad.addColorStop(0, '#667eea');
        grad.addColorStop(1, '#764ba2');
        ctx.fillStyle = grad;
        drawRoundRect(ctx, x, y, w, yutH, 8);
        ctx.fill();
        
        // 棍子
        for (let i = 0; i < 4; i++) {
            this.drawStick(x + 20 + i * ((w-40)/3), y + 20, 12, 40, this.sticks[i]);
        }
        
        // 掷柶按钮
        const canThrow = !this.animating && this.moves.length === 0 && !this.isThrowing &&
            !(this.mode === 'ai' && this.current === 'B') &&
            !(this.mode === 'online' && OnlineManager.matchStatus === 'playing' && 
              ((OnlineManager.isHost && this.current !== 'A') || (!OnlineManager.isHost && this.current !== 'B')));
        
        this.drawButton(x + 5, y + 75, w - 10, 35, canThrow ? '#27ae60' : '#95a5a6', '🎲 掷柶', false);
        if (canThrow) {
            this.addButton(x + 5, y + 75, w - 10, 35, () => this.throwYut(), 'throw');
        }
        
        // 结果显示
        if (this.lastResult && !this.isThrowing) {
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            drawRoundRect(ctx, x + 5, y + 115, w - 10, 20, 4);
            ctx.fill();
            ctx.fillStyle = 'white';
            ctx.font = 'bold 12px Microsoft YaHei';
            ctx.fillText(`${this.lastResult.name}(${this.lastResult.chinese})`, x + w/2, y + 129);
        }
        y += yutH + 10;
        
        // 规则按钮
        this.drawButton(x, y, w, 35, '#f39c12', '📜 规则', false);
        this.addButton(x, y, w, 35, () => this.toggleRules(), 'rules');
    },

    drawButton(x, y, w, h, color, text, active) {
        ctx.fillStyle = active ? color : (color === '#fff' ? '#fff' : color);
        drawRoundRect(ctx, x, y, w, h, 6);
        ctx.fill();
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = active ? '#fff' : '#333';
        ctx.font = 'bold 12px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x + w/2, y + h/2);
    },

    drawStick(x, y, w, h, stick) {
        ctx.save();
        ctx.translate(x + w/2, y + h/2);
        ctx.rotate(stick.angle);
        
        if (stick.isHalf) {
            ctx.fillStyle = '#4caf50';
            ctx.fillRect(-w/2, -h/2, w, h/2);
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(-w/2, 0, w, h/2);
            ctx.beginPath();
            ctx.moveTo(-w/2, 0);
            ctx.lineTo(w/2, 0);
            ctx.strokeStyle = '#3e2723';
            ctx.lineWidth = 1;
            ctx.stroke();
        } else {
            ctx.fillStyle = stick.color;
            ctx.fillRect(-w/2, -h/2, w, h);
        }
        ctx.strokeStyle = '#3e2723';
        ctx.lineWidth = 1;
        ctx.strokeRect(-w/2, -h/2, w, h);
        ctx.restore();
    },

    drawBoard() {
        const bx = this.layout.boardX, by = this.layout.boardY, s = this.layout.boardSize;
        
        // 外框
        ctx.fillStyle = '#0f1419';
        drawRoundRect(ctx, bx, by, s, s, 12);
        ctx.fill();
        ctx.strokeStyle = '#8b4513';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // 棋盘背景
        const pad = s * 0.06;
        const ix = bx + pad, iy = by + pad;
        const innerSize = s - pad * 2;
        
        const bgGrad = ctx.createRadialGradient(ix + innerSize/2, iy + innerSize/2, 0, ix + innerSize/2, iy + innerSize/2, innerSize);
        bgGrad.addColorStop(0, '#f5f5dc');
        bgGrad.addColorStop(1, '#d4cfb0');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(ix, iy, innerSize, innerSize);
        
        // 线路
        ctx.strokeStyle = '#2c1810';
        ctx.lineWidth = 2;
        const coords = (pos) => toScreen(SPOTS[pos].x, SPOTS[pos].y, ix, iy, innerSize);
        
        // 外圈
        ctx.beginPath();
        [0, 5, 10, 15].map(coords).forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        ctx.stroke();
        
        // 对角线
        const c5 = coords(5), c10 = coords(10), c15 = coords(15), c22 = coords(22), c0 = coords(0);
        ctx.beginPath();
        ctx.moveTo(c5.x, c5.y);
        ctx.lineTo(c22.x, c22.y);
        ctx.lineTo(c15.x, c15.y);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(c10.x, c10.y);
        ctx.lineTo(c22.x, c22.y);
        ctx.lineTo(c0.x, c0.y);
        ctx.stroke();
        
        // 点位
        Object.keys(SPOTS).forEach(key => {
            const p = coords(key);
            const isCenter = Number(key) === 22;
            const isCorner = [0, 5, 10, 15].includes(Number(key));
            
            if (isCenter) {
                this.drawTaiji(p.x, p.y, s * 0.06);
            } else {
                ctx.beginPath();
                ctx.arc(p.x, p.y, isCorner ? s * 0.025 : s * 0.018, 0, Math.PI * 2);
                ctx.fillStyle = isCorner ? '#8B4513' : '#f4e4c1';
                ctx.fill();
                ctx.strokeStyle = '#3e2723';
                ctx.lineWidth = isCorner ? 2 : 1;
                ctx.stroke();
            }
        });
    },

    drawTaiji(x, y, r) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = 'white';
        ctx.fill();
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(x, y, r, Math.PI * 0.5, Math.PI * 1.5);
        ctx.fillStyle = '#2c1810';
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(x, y - r/2, r/2, 0, Math.PI * 2);
        ctx.fillStyle = 'white';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y - r/2, r/6, 0, Math.PI * 2);
        ctx.fillStyle = '#2c1810';
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(x, y + r/2, r/2, 0, Math.PI * 2);
        ctx.fillStyle = '#2c1810';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y + r/2, r/6, 0, Math.PI * 2);
        ctx.fillStyle = 'white';
        ctx.fill();
    },

    drawPieces() {
        const ix = this.layout.boardX + this.layout.boardSize * 0.06;
        const iy = this.layout.boardY + this.layout.boardSize * 0.06;
        const innerSize = this.layout.boardSize * 0.88;
        const r = this.layout.boardSize * 0.04;
        
        ['A', 'B'].forEach(pl => {
            const posMap = {};
            this.pieces[pl].forEach((pc, idx) => {
                if (pc.pos !== null && !pc.done) {
                    if (!posMap[pc.pos]) posMap[pc.pos] = [];
                    posMap[pc.pos].push({idx, pl});
                }
            });
            
            Object.entries(posMap).forEach(([posId, pieces]) => {
                const spot = SPOTS[posId];
                const p = toScreen(spot.x, spot.y, ix, iy, innerSize);
                
                pieces.forEach((piece, i) => {
                    const px = p.x + i * 6;
                    const py = p.y + i * -6;
                    const isSelected = this.selectedPieces.some(sp => sp.pl === piece.pl && sp.idx === piece.idx);
                    const isWaiting = this.pieces[piece.pl][piece.idx].waitingBack;
                    
                    this.drawCirclePiece(px, py, r, piece.pl === 'A' ? '#c92a2a' : '#1864ab', piece.idx + 1, isSelected, isWaiting);
                    
                    this.addButton(px - r, py - r, r * 2, r * 2, () => {
                        AudioSys.play('select');
                        this.onPieceClick(piece.pl, piece.idx);
                    }, 'board-piece', { player: piece.pl, idx: piece.idx });
                });
            });
        });
    },

    drawCirclePiece(x, y, r, color, number, selected, isWaiting) {
        if (isWaiting) {
            ctx.beginPath();
            ctx.arc(x, y, r + 4, 0, Math.PI * 2);
            ctx.fillStyle = '#ffd700';
            ctx.fill();
            const alpha = 0.5 + 0.5 * Math.sin(this.flashTimer * Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 215, 0, ${alpha})`;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = 'white';
        ctx.fill();
        
        if (selected) {
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 3;
            ctx.stroke();
        }
        
        const grad = ctx.createRadialGradient(x - r*0.3, y - r*0.3, 0, x, y, r);
        grad.addColorStop(0, color === '#c92a2a' ? '#ff6b6b' : '#4dabf7');
        grad.addColorStop(1, color);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r * 0.85, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = 'white';
        ctx.font = `bold ${Math.floor(r * 0.9)}px Microsoft YaHei`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(number.toString(), x, y);
    },

    drawHints() {
        if (this.possibleTargets.length === 0) return;
        
        const ix = this.layout.boardX + this.layout.boardSize * 0.06;
        const iy = this.layout.boardY + this.layout.boardSize * 0.06;
        const innerSize = this.layout.boardSize * 0.88;
        const alpha = 0.4 + 0.4 * Math.sin(this.flashTimer * Math.PI * 2);
        
        this.possibleTargets.forEach(target => {
            let p;
            if (target.finish) {
                p = toScreen(SPOTS[0].x, SPOTS[0].y, ix, iy, innerSize);
            } else {
                const spot = SPOTS[target.pos];
                p = toScreen(spot.x, spot.y, ix, iy, innerSize);
            }
            
            const r = 22;
            ctx.beginPath();
            ctx.arc(p.x, p.y, r + 4, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 215, 0, ${alpha * 0.3})`;
            ctx.fill();
            
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.fillStyle = target.finish ? '#4caf50' : '#ffd700';
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            ctx.fillStyle = target.finish ? 'white' : '#5d4037';
            ctx.font = 'bold 13px Microsoft YaHei';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(target.finish ? '完' : (target.label || ''), p.x, p.y);
            
            this.addButton(p.x - 25, p.y - 25, 50, 50, () => {
                AudioSys.play('move');
                this.executeMove(target);
            }, 'target', target);
        });
    },

    drawUI() {
        const barH = 44;
        const barY = screenHeight - barH - 10;
        
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, barY, screenWidth, barH);
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 1;
        drawRoundRect(ctx, screenWidth/2 - 140, barY + 5, 280, barH - 10, 5);
        ctx.stroke();
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 15px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.hintText, screenWidth/2, barY + barH/2);
    },

    addButton(x, y, w, h, callback, type, data) {
        this.buttons.push({ x, y, w, h, callback, type, data });
    },

    // ==================== 游戏逻辑 ====================
    onPieceClick(pl, idx) {
        if (this.animating) return;
        if (this.moves.length === 0) {
            this.updateHint('请先掷柶！');
            return;
        }
        
        // 在线模式权限检查
        if (this.mode === 'online') {
            const myPlayer = OnlineManager.isHost ? 'A' : 'B';
            if (pl !== myPlayer) {
                this.updateHint('不能操作对方棋子！');
                return;
            }
        }
        
        if (pl !== this.current) {
            this.updateHint(`现在是${this.current === 'A' ? '甲方' : '乙方'}的回合`);
            return;
        }
        
        const move = this.moves[0];
        const pc = this.pieces[pl][idx];
        
        if (pc.waitingBack && move === -1) {
            this.completePiece(pl, idx);
            return;
        }
        
        if (move < 0 && pc.pos === null) {
            this.updateHint('窝里的棋子不能后退！');
            return;
        }
        
        if (this.selectedPieces.some(p => p.pl === pl && p.idx === idx)) {
            this.selectedPieces = [];
            this.possibleTargets = [];
            return;
        }
        
        this.selectedPieces = [];
        this.possibleTargets = [];
        
        if (pc.pos === null) {
            this.selectedPieces = [{pl, idx}];
            this.calculateTargets(pl, idx, move, null, false);
            this.updateHint(`${pl === 'A' ? '甲' : '乙'}${idx + 1}号准备出发`);
        } else {
            const samePos = [];
            this.pieces[pl].forEach((p, i) => {
                if (p.pos === pc.pos && !p.done) samePos.push(i);
            });
            this.selectedPieces = samePos.map(i => ({pl, idx: i}));
            this.calculateTargets(pl, idx, move, pc.pos, pc.hasLeftStart, pc.path);
            this.updateHint(`选中${samePos.length}个棋子`);
        }
    },

    completePiece(pl, idx) {
        this.animating = true;
        const pc = this.pieces[pl][idx];
        pc.waitingBack = false;
        pc.done = true;
        pc.pos = null;
        this.finished[pl]++;
        this.moves.shift();
        
        AudioSys.play('win');
        this.selectedPieces = [];
        this.possibleTargets = [];
        this.updateHint(`${pl === 'A' ? '甲' : '乙'}${idx + 1}号完成！`);
        
        // 在线同步
        if (this.mode === 'online') {
            OnlineManager.sendGameAction({ type: 'complete', player: pl, idx: idx });
        }
        
        if (this.finished[pl] >= 4) {
            setTimeout(() => this.endGame(pl), 1000);
            return;
        }
        
        setTimeout(() => {
            this.animating = false;
            if (this.moves.length > 0) this.updateHint('还有步数');
            else this.nextTurn();
        }, 600);
    },

    calculateTargets(pl, idx, move, fromPos, hasLeftStart, currentPath) {
        this.possibleTargets = [];
        
        if (move < 0) {
            const backResult = this.simulateBack(fromPos, currentPath);
            if (backResult) {
                this.possibleTargets.push({ pos: backResult.pos, path: backResult.path, finish: false, label: '退' });
            }
        } else {
            if (fromPos === null) {
                this.possibleTargets.push(this.simulateMove(0, move, 'outer', false));
            } else if (fromPos === 5) {
                this.possibleTargets.push({...this.simulateMove(5, move, 'outer', hasLeftStart), label: '边'});
                this.possibleTargets.push({...this.simulateMove(5, move, 'diag1', hasLeftStart), label: '对角'});
            } else if (fromPos === 10) {
                this.possibleTargets.push({...this.simulateMove(10, move, 'outer', hasLeftStart), label: '边'});
                this.possibleTargets.push({...this.simulateMove(10, move, 'diag2', hasLeftStart), label: '对角'});
            } else if (fromPos === 22 && currentPath === 'diag1') {
                this.possibleTargets.push({...this.simulateMove(22, move, 'diag1', hasLeftStart), label: '左下'});
                this.possibleTargets.push({...this.simulateMove(22, move, 'diag2', hasLeftStart), label: '右下'});
            } else {
                const path = currentPath || 'outer';
                this.possibleTargets.push(this.simulateMove(fromPos, move, path, hasLeftStart));
            }
        }
    },

    simulateMove(from, steps, path, hasLeftStart) {
        let pos = from, remaining = steps, currentPath = path;
        if (from === 0 && !hasLeftStart) currentPath = 'outer';
        
        while (remaining > 0) {
            if (pos === 0 && hasLeftStart && remaining >= 1) {
                return { pos: -1, path: currentPath, finish: true, label: '完' };
            }
            
            let pathArr = PATHS[currentPath];
            let idx = pathArr.indexOf(pos);
            
            if (idx === -1) {
                for (let pName in PATHS) {
                    const testArr = PATHS[pName];
                    const testIdx = testArr.indexOf(pos);
                    if (testIdx !== -1) {
                        currentPath = pName;
                        pathArr = testArr;
                        idx = testIdx;
                        break;
                    }
                }
            }
            
            if (idx === -1) break;
            else if (idx >= pathArr.length - 1) {
                if (currentPath === 'outer' && pos === 19) {
                    pos = 0; remaining--;
                    if (hasLeftStart && remaining === 0) return { pos: 0, path: 'outer', finish: false };
                } else if (currentPath === 'diag2' && pos === 28) {
                    pos = 0; remaining--;
                    if (hasLeftStart && remaining === 0) return { pos: 0, path: 'outer', finish: false };
                } else if (currentPath === 'diag1' && pos === 15) {
                    pos = 16; currentPath = 'outer'; remaining--;
                } else break;
            } else {
                pos = pathArr[idx + 1];
                remaining--;
            }
        }
        return { pos, path: currentPath, finish: false };
    },

    simulateBack(from, currentPath) {
        if (currentPath && PATHS[currentPath]) {
            const pathArr = PATHS[currentPath];
            const idx = pathArr.indexOf(from);
            if (idx > 0) return { pos: pathArr[idx - 1], path: currentPath };
            else if (idx === 0) {
                if (currentPath === 'diag1') return { pos: 4, path: 'outer' };
                if (currentPath === 'diag2') return { pos: 9, path: 'outer' };
            }
        }
        const outerArr = PATHS.outer;
        const idx = outerArr.indexOf(from);
        if (idx > 0) return { pos: outerArr[idx - 1], path: 'outer' };
        else if (idx === 0) return { pos: 19, path: 'outer' };
        return null;
    },

    executeMove(target) {
        if (this.selectedPieces.length === 0) return;
        
        const { pl, idx } = this.selectedPieces[0];
        const move = this.moves[0];
        const opp = pl === 'A' ? 'B' : 'A';
        
        this.animating = true;
        this.moves.shift();
        this.possibleTargets = [];
        
        let capturedCount = 0;
        let enteredWaiting = false;
        
        this.selectedPieces.forEach(({pl: p, idx: i}) => {
            const pc = this.pieces[p][i];
            
            if (move < 0 && target.pos === 0 && pc.hasLeftStart && !pc.waitingBack) {
                pc.waitingBack = true;
                enteredWaiting = true;
                pc.pos = 0;
            } else {
                if (!target.finish && target.pos !== null && capturedCount === 0) {
                    this.pieces[opp].forEach((pcOpp, idxOpp) => {
                        if (pcOpp.pos === target.pos && !pcOpp.done && !pcOpp.waitingBack) {
                            pcOpp.pos = null;
                            pcOpp.hasLeftStart = false;
                            pcOpp.path = null;
                            this.nest[opp].push(idxOpp);
                            capturedCount++;
                        }
                    });
                }
                
                if (pc.pos === null && !pc.done) {
                    this.nest[p] = this.nest[p].filter(id => id !== i);
                    pc.hasLeftStart = true;
                }
                
                if (target.finish) {
                    pc.pos = null; pc.done = true; pc.path = null; pc.waitingBack = false;
                    this.finished[p]++;
                } else {
                    pc.pos = target.pos;
                    pc.path = target.path;
                    if (pc.pos !== 0) pc.hasLeftStart = true;
                }
            }
        });
        
        // 在线同步
        if (this.mode === 'online') {
            OnlineManager.sendGameAction({
                type: 'move',
                player: pl,
                target: target,
                pieces: this.pieces,
                nest: this.nest,
                finished: this.finished,
                captured: capturedCount > 0
            });
        }
        
        if (enteredWaiting) {
            AudioSys.play('move');
            this.updateHint('棋子退回起点，需再次点击完成');
        } else if (capturedCount > 0) {
            AudioSys.play('catch');
            this.extraTurn = true;
        } else {
            AudioSys.play('move');
        }
        
        this.selectedPieces = [];
        
        if (this.finished[pl] >= 4) {
            setTimeout(() => this.endGame(pl), 1000);
            return;
        }
        
        setTimeout(() => {
            this.animating = false;
            if (this.moves.length > 0) this.updateHint('还有步数');
            else if (this.extraTurn) {
                this.extraTurn = false;
                this.updateHint('获得额外回合！');
                if ((this.mode === 'ai' && pl === 'B') || (this.mode === 'online')) {
                    setTimeout(() => this.throwYut(), 1500);
                }
            } else {
                this.nextTurn();
            }
        }, 600);
    },

    throwYut() {
        if (this.animating || this.moves.length > 0 || this.isThrowing) return;
        
        // 在线模式检查
        if (this.mode === 'online') {
            const myPlayer = OnlineManager.isHost ? 'A' : 'B';
            if (this.current !== myPlayer) {
                this.updateHint('等待对方...');
                return;
            }
        }
        
        this.isThrowing = true;
        this.throwAnimationFrame = 0;
        AudioSys.play('throw');
        
        this.sticks.forEach(s => { s.isHalf = false; s.color = '#8B4513'; });
        
        const hasPiecesOnBoard = this.pieces[this.current].some(p => p.pos !== null && !p.done);
        const rand = Math.random();
        let result;
        
        if (!hasPiecesOnBoard) {
            if (rand < 0.2062) result = {name: '도', chinese: '一步', move: 1, again: false, greens: 1};
            else if (rand < 0.5876) result = {name: '개', chinese: '二步', move: 2, again: false, greens: 2};
            else if (rand < 0.8969) result = {name: '걸', chinese: '三步', move: 3, again: false, greens: 3};
            else if (rand < 0.9484) result = {name: '윷', chinese: '四步', move: 4, again: true, greens: 4};
            else result = {name: '모', chinese: '五步', move: 5, again: true, greens: 0};
        } else {
            if (rand < 0.20) result = {name: '도', chinese: '一步', move: 1, again: false, greens: 1};
            else if (rand < 0.57) result = {name: '개', chinese: '二步', move: 2, again: false, greens: 2};
            else if (rand < 0.87) result = {name: '걸', chinese: '三步', move: 3, again: false, greens: 3};
            else if (rand < 0.92) result = {name: '윷', chinese: '四步', move: 4, again: true, greens: 4};
            else if (rand < 0.97) result = {name: '모', chinese: '五步', move: 5, again: true, greens: 0};
            else result = {name: '백도', chinese: '退一步', move: -1, again: false, greens: 0, isBack: true};
        }
        
        // 设置棍子显示
        if (result.isBack) {
            this.sticks[0].isHalf = true;
            for (let i = 1; i < 4; i++) this.sticks[i].targetColor = '#8B4513';
        } else {
            for (let i = 0; i < 4; i++) {
                this.sticks[i].targetColor = i < result.greens ? '#4caf50' : '#8B4513';
            }
        }
        
        this.pendingResult = result;
        
        // 在线同步
        if (this.mode === 'online') {
            OnlineManager.sendGameAction({ type: 'throw', result: result });
        }
    },

    updateThrowAnimation() {
        this.throwAnimationFrame++;
        if (this.throwAnimationFrame < 30) {
            this.sticks.forEach((s, i) => {
                s.angle += 0.3 + i * 0.05;
                if (!s.isHalf) s.color = Math.random() > 0.5 ? '#4caf50' : '#8B4513';
            });
        } else if (this.throwAnimationFrame < 60) {
            this.sticks.forEach(s => s.angle *= 0.9);
        } else {
            this.isThrowing = false;
            this.finalizeThrow();
        }
    },

    finalizeThrow() {
        this.sticks.forEach(s => { s.color = s.targetColor; s.angle = 0; });
        const result = this.pendingResult;
        this.moves.push(result.move);
        this.extraTurn = result.again;
        this.lastResult = result;
        
        const waitingCount = this.pieces[this.current].filter(p => p.waitingBack).length;
        if (waitingCount > 0 && result.move === -1) {
            this.updateHint(`${waitingCount}颗棋子等待完成`);
        } else {
            this.updateHint(`点击棋子选择移动位置`);
        }
        
        // AI回合
        if (this.mode === 'ai' && this.current === 'B') {
            setTimeout(() => this.aiPlay(), 1000);
        }
    },

    handleOpponentAction(action) {
        switch(action.type) {
            case 'throw':
                this.pendingResult = action.result;
                this.isThrowing = true;
                this.throwAnimationFrame = 0;
                if (action.result.isBack) {
                    this.sticks[0].isHalf = true;
                } else {
                    for (let i = 0; i < 4; i++) {
                        this.sticks[i].targetColor = i < action.result.greens ? '#4caf50' : '#8B4513';
                    }
                }
                AudioSys.play('throw');
                break;
            case 'move':
                this.pieces = action.pieces;
                this.nest = action.nest;
                this.finished = action.finished;
                this.nextTurn();
                break;
            case 'complete':
                const pc = this.pieces[action.player][action.idx];
                pc.waitingBack = false;
                pc.done = true;
                pc.pos = null;
                this.finished[action.player]++;
                break;
        }
    },

    aiPlay() {
        setTimeout(() => {
            if (this.moves.length === 0) return;
            const move = this.moves[0];
            
            if (move === -1) {
                const waitingIdx = this.pieces.B.findIndex(p => p.waitingBack);
                if (waitingIdx !== -1) {
                    this.completePiece('B', waitingIdx);
                    return;
                }
            }
            
            const candidates = [];
            this.pieces.B.forEach((pc, idx) => {
                if (pc.done) return;
                if (move < 0 && pc.pos === null) return;
                if (pc.waitingBack) return;
                
                let score = Math.random() * 10;
                if (pc.pos !== null) score += 20;
                if (pc.pos === 5 || pc.pos === 10) score += 15;
                candidates.push({idx, score});
            });
            
            if (candidates.length > 0) {
                candidates.sort((a, b) => b.score - a.score);
                const best = candidates[0];
                this.onPieceClick('B', best.idx);
                setTimeout(() => {
                    if (this.possibleTargets.length > 0) {
                        const target = this.possibleTargets.find(t => t.label === '对角' || t.finish) || this.possibleTargets[0];
                        this.executeMove(target);
                    }
                }, 800);
            } else {
                this.updateHint('乙方无子可动');
                setTimeout(() => this.nextTurn(), 1500);
            }
        }, 500);
    },

    nextTurn() {
        this.current = this.current === 'A' ? 'B' : 'A';
        this.selectedPieces = [];
        this.possibleTargets = [];
        this.updateHint(`${this.current === 'A' ? '甲方' : '乙方'}回合：点击掷柶`);
        
        if (this.mode === 'ai' && this.current === 'B') {
            setTimeout(() => this.throwYut(), 1000);
        }
    },

    endGame(winner) {
        this.gameOver = true;
        FireworkSystem.start();
        
        const winnerText = winner === 'A' ? '甲方' : (this.mode === 'ai' ? '电脑' : '乙方');
        
        wx.showModal({
            title: '🎉 游戏结束 🎉',
            content: `${winnerText}获胜！`,
            showCancel: false,
            success: () => {
                FireworkSystem.stop();
                this.gameOver = false;
                this.restart();
            }
        });
        
        if (this.mode === 'online') {
            setTimeout(() => OnlineManager.disconnect(), 2000);
        }
    },

    setMode(m) {
        if (this.mode === 'online' && m !== 'online') {
            OnlineManager.disconnect();
        }
        this.mode = m;
        this.restart();
        if (m === 'online') {
            wx.showModal({
                title: '在线模式',
                content: '点击"匹配"按钮开始寻找对手',
                showCancel: false
            });
        }
    },

    startOnlineGame(isHost) {
        this.restart();
        OnlineManager.matchStatus = 'playing';
        this.current = 'A';
        this.updateHint('在线对战开始！');
        wx.showToast({ title: '游戏开始！', icon: 'success' });
    },

    restart() {
        this.current = 'A';
        this.pieces = {
            A: Array(4).fill(null).map(() => ({ pos: null, done: false, hasLeftStart: false, path: null, waitingBack: false })),
            B: Array(4).fill(null).map(() => ({ pos: null, done: false, hasLeftStart: false, path: null, waitingBack: false }))
        };
        this.nest = { A: [0,1,2,3], B: [0,1,2,3] };
        this.finished = { A: 0, B: 0 };
        this.moves = [];
        this.extraTurn = false;
        this.animating = false;
        this.selectedPieces = [];
        this.possibleTargets = [];
        this.lastResult = null;
        this.isThrowing = false;
        this.gameOver = false;
        this.updateHint('点击「掷柶」开始游戏');
    },

    toggleRules() {
        wx.showModal({
            title: '📜 游戏规则',
            content: '🟢绿面数量决定步数：\n1绿=도(1步) 2绿=개(2步)\n3绿=걸(3步) 4绿=윷(4步+再掷)\n0绿=모(5步+再掷) 或 백도(-1步)\n\n⚠️ 无棋子时不会出-1\n🎯 退至起点需再掷-1完成\n🏹 吃完对方棋子可再掷！\n\n🎮 在线模式：自动匹配对手',
            showCancel: false
        });
    },

    updateHint(text) {
        this.hintText = text;
    },

    setupTouch() {
        wx.onTouchStart((e) => {
            const touch = e.touches[0];
            for (let btn of this.buttons) {
                if (touch.clientX >= btn.x && touch.clientX <= btn.x + btn.w &&
                    touch.clientY >= btn.y && touch.clientY <= btn.y + btn.h) {
                    btn.callback();
                    return;
                }
            }
            if (this.selectedPieces.length > 0) {
                this.selectedPieces = [];
                this.possibleTargets = [];
            }
        });
    },

    startGameLoop() {
        const loop = () => {
            this.draw();
            requestAnimationFrame(loop);
        };
        loop();
    }
};

Game.init();