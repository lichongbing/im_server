var qr = require('qr-image');
module.exports = {
    // api返回成功
    apiSuccess(data = '', msg = 'ok', code = 200) {
        this.status = 200;
        this.body = { msg, data };
    },
    // api返回失败
    apiFail(data = '', msg = 'fail', code = 400) {
        this.body = { msg, data };
        this.status = code;
    },
    // 生成token
    getToken(value) {
        return this.app.jwt.sign(value, this.app.config.jwt.secret);
    },
    // 验证token
    checkToken(token) {
        return this.app.jwt.verify(token, this.app.config.jwt.secret);
    },
    // 发送或者存到消息队列中
    async sendAndSaveMessage(to_id, message, msg = 'ok') {
        const { app, service } = this;
        let current_user_id = this.authUser.id;

        // 拿到接受用户所在子进程
        let pid = await service.cache.get('online_' + to_id);

        if (pid) {
            // 消息推送
            app.messenger.sendTo(pid, 'send', {
                to_id, message, msg
            });
            // 存到历史记录当中
            if (msg === 'ok') {
                service.cache.setList(`chatlog_${to_id}_${message.chat_type}_${current_user_id}`, message);
            }
        } else {
            service.cache.setList('getmessage_' + to_id, {
                message,
                msg
            });
        }

        // 拿到对方的socket
        // let socket = app.ws.user[to_id];
        // 验证对方是否在线？不在线记录到待接收消息队列中；在线，消息推送，存储到对方的聊天记录中 chatlog_对方用户id_user_当前用户id
        // if (app.ws.user && app.ws.user[to_id]) {
        //     // 消息推送
        //     app.ws.user[to_id].send(JSON.stringify({
        //         msg,
        //         data: message
        //     }));
        //     // 存到历史记录当中
        //     if (msg === 'ok') {
        //         service.cache.setList(`chatlog_${to_id}_${message.chat_type}_${current_user_id}`, message);
        //     }
        // } else {
        //     service.cache.setList('getmessage_' + to_id, {
        //         message,
        //         msg
        //     });
        // }
    },
    // 发送消息
    async send(to_id, message, msg = 'ok') {
        const { app, service } = this;
        let current_user_id = this.authUser.id;

        // 拿到接受用户所在子进程
        let pid = await service.cache.get('online_' + to_id);

        if (pid) {
            // 消息推送
            app.messenger.sendTo(pid, 'send', {
                to_id, message, msg
            });
        }
    },
    // 生成二维码
    qrcode(data) {
        var image = qr.image(data, { size: 10 });
        this.response.type = 'image/png';
        this.body = image;
    },
    // 生成唯一id
    genID(length) {
        return Number(Math.random().toString().substr(3, length) + Date.now()).toString(36);
    },
    // 用户上线
    async online(user_id) {
        const { service, app } = this;
        let pid = process.pid;
        // 下线其他设备
        let opid = await service.cache.get('online_' + user_id);
        if (opid) {
            // 通知对应进程用户下线
            app.messenger.sendTo(opid, 'offline', user_id);
        }
        // 存储上线状态
        service.cache.set('online_' + user_id, pid);
    }
};