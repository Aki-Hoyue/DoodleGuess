# DoodleGuess
[English](https://github.com/Aki-Hoyue/DoodleGuess/blob/main/README.md) | 中文    
DoodleGuess 是一个基于 AI 判定的在线多人绘画猜谜游戏。玩家通过创建或加入房间进行游戏，每回合由一名玩家进行绘画，其他玩家根据绘画内容进行猜测。游戏使用 AI 技术对猜测进行评判, 并由绘画者进行最终确认。

## 主要功能
- 实时绘图，支持 WebSocket
- AI 辅助答案判断
- 房间管理系统
- 计分系统

## 技术栈
前端：
- React.js
- WebSocket
- HTML5 Canvas

后端：
- FastAPI
- WebSocket
- OpenAI API

## 系统架构
### 主要前端组件

1. **RoomManagement - 房间管理组件**
   - 创建房间
   - 加入房间
   - 设置房间参数

2. **DrawingCanvas - 绘画组件**
   - HTML5 Canvas 绘画功能
   - 画笔/橡皮擦工具
   - 画笔大小/颜色选择

3. **Viewer - 观看组件**
   - 查看实时绘画
   - 提交猜测

4. **Judge - 判定组件**
   - 显示 AI 判定结果
   - 人工确认判定

### 主要后端模块

1. **websocket.py - WebSocket 管理**
2. **game.py - 游戏逻辑**

![Architecture.png](https://s2.loli.net/2024/12/14/pBNoh6nYQ8zIDAd.png)

## 游戏流程

1. 创建/加入房间
   - 设置房间密码
   - 设置最大玩家数
   - 设置回合数
2. 游戏回合
   - 轮流担任画师
   - 其他玩家猜测
   - AI 判定 + 人工确认
   - 计分更新
3. 游戏结束
   - 显示最终得分
   - 展示详细统计

![Flow.png](https://s2.loli.net/2024/12/14/zk461R3ebLlBAPV.png)

## API 文档

### WebSocket 事件

| 事件           | 描述     | 数据结构                    |
| -------------- | -------- | --------------------------- |
| create_room    | 创建房间 | `{roomId, settings}`        |
| join_room      | 加入房间 | `{roomId, playerId}`        |
| submit_drawing | 提交绘画 | `{roomId, imageData}`       |
| submit_guess   | 提交猜测 | `{roomId, playerId, guess}` |

### REST 接口

| 接口            | 方法 | 描述         |
| --------------- | ---- | ------------ |
| /api/rooms      | GET  | 获取房间列表 |
| /api/rooms      | POST | 创建新房间   |
| /api/rooms/{id} | GET  | 获取房间详情 |

## 部署

```shell
# 安装依赖
pip install -r requirements.txt
npm install

# 启动后端
uvicorn main:app --reload

# 启动前端
npm start
```

## 环境配置
你可以复制`.env.example`进行修改，并改名为`.env`。其中包含如下的配置。

```shell
# AI Configuration
AI_MODEL=YOUR_MODEL_HERE
AI_BASE_URL=YOUR_BASE_URL_HERE
AI_KEY=YOUR_API_KEY_HERE

# Server Configuration
REACT_APP_SERVER_BASE_URL=YOUR_SERVER_BASE_URL_HERE
```

## TODO

1. **功能增强**
   - 添加更多绘画工具
   - 支持撤销/重做
   - 增加游戏模式
2. **性能优化**
   - WebSocket 连接优化
   - 图片传输压缩
   - 前端性能优化
3. **用户体验**
   - 移动端适配
   - 国际化支持
   - 主题定制

## 贡献者

- Backend Engineer:  ![@Aki-Hoyue](https://avatars.githubusercontent.com/u/73027485?s=64&v=4)](https://github.com/Aki-Hoyue)[**Aki-Hoyue** Hoyue](https://github.com/Aki-Hoyue)
- Frontend Engineer: [![@0216Feng](https://avatars.githubusercontent.com/u/90129509?s=64&v=4)](https://github.com/0216Feng)[**0216Feng** HUO ZHIFENG](https://github.com/0216Feng)
