'use strict';

/**
 * @param {Egg.Application} app - egg application
 */
module.exports = app => {
  const { router, controller } = app;
  router.get('/', controller.home.index);
  // 用户注册
  router.post('/reg', controller.user.reg);
  // 用户登录
  router.post('/login', controller.user.login);
  // 退出登录
  router.post('/logout', controller.user.logout);
  // 搜索用户
  router.post('/search/user', controller.search.user);
  // 申请添加好友
  router.post('/apply/addfriend', controller.apply.addFriend);
  // 获取好友申请列表
  router.get('/apply/:page', controller.apply.list);
  // 处理好友申请
  router.post('/apply/handle/:id', controller.apply.handle);
  // 通讯录列表
  router.get('/friend/list', controller.friend.list);
  // 查看用户资料
  router.get('/friend/read/:id', controller.friend.read);
  // 移入/移除黑名单
  router.post('/friend/setblack/:id', controller.friend.setblack);
  // 设置/取消星标好友
  router.post('/friend/setstar/:id', controller.friend.setstar);
  // 设置朋友圈权限
  router.post('/friend/setmomentauth/:id', controller.friend.setMomentAuth);
  // 举报投诉好友/群组
  router.post('/report/save', controller.report.save);
  // 设置备注和标签
  router.post('/friend/setremarktag/:id', controller.friend.setremarkTag);




  app.ws.use(async (ctx, next) => {
    // 获取参数 ws://localhost:7001/ws?token=123456
    // ctx.query.token
    // 验证用户token
    let user = {};
    let token = ctx.query.token;
    try {
      user = ctx.checkToken(token);
      // 验证用户状态
      let userCheck = await app.model.User.findByPk(user.id);
      if (!userCheck) {
        ctx.websocket.send(JSON.stringify({
          msg: "fail",
          data: '用户不存在'
        }));
        return ctx.websocket.close();
      }
      if (!userCheck.status) {
        ctx.websocket.send(JSON.stringify({
          msg: "fail",
          data: '你已被禁用'
        }));
        return ctx.websocket.close();
      }
      // 用户上线 
      app.ws.user = app.ws.user ? app.ws.user : {};
      // 下线其他设备
      // if (app.ws.user[user.id]) {
      //   app.ws.user[user.id].send(JSON.stringify({
      //     msg: "fail",
      //     data: '你的账号在其他设备登录'
      //   }));
      //   app.ws.user[user.id].close();
      // }
      // 记录当前用户id
      ctx.websocket.user_id = user.id;
      app.ws.user[user.id] = ctx.websocket;

      ctx.online(user.id);

      await next();
    } catch (err) {
      console.log(err);
      let fail = err.name === 'TokenExpiredError' ? 'token 已过期! 请重新获取令牌' : 'Token 令牌不合法!';
      ctx.websocket.send(JSON.stringify({
        msg: "fail",
        data: fail
      }))
      // 关闭连接
      ctx.websocket.close();
    }
  });

  // websocket
  app.ws.route('/ws', controller.chat.connect);

  // 发送消息
  router.post('/chat/send', controller.chat.send);
  // 创建群聊
  router.post('/group/create', controller.group.create);
  // 获取离线消息
  router.post('/chat/getmessage', controller.chat.getmessage);
  // 群聊列表
  router.get('/group/:page', controller.group.list);
  // 获取群资料
  router.get('/group_info/:id', controller.group.info);
  // 修改群名称
  router.post('/group/rename', controller.group.rename);
  // 推送群公告
  router.post('/group/remark', controller.group.remark);
  // 修改我在本群中的昵称
  router.post('/group/nickname', controller.group.nickname);
  // 删除并退出群聊
  router.post('/group/quit', controller.group.quit);
  // 生成群二维码
  router.get('/group_qrcode/:id', controller.group.qrcode);
  // 生成个人二维码名片
  router.get('/user_qrcode/:id', controller.user.qrcode);
  // 上传文件
  router.post('/upload', controller.common.upload);
  // 撤回消息
  router.post('/chat/recall', controller.chat.recall);
  // 创建收藏
  router.post('/fava/create', controller.fava.create);
  // 收藏列表
  router.get('/fava/:page', controller.fava.list);
  // 删除收藏
  router.post('/fava/destroy', controller.fava.destroy);
  // 修改用户个人资料
  router.post('/user/update', controller.user.update);
  // 删除好友
  router.post('/friend/destroy', controller.friend.destroy);
  // 发布朋友圈
  router.post('/moment/create', controller.moment.create);
  // 点赞朋友圈
  router.post('/moment/like', controller.moment.like);
  // 评论朋友圈
  router.post('/moment/comment', controller.moment.comment);
  // 朋友圈列表
  router.get('/moment_timeline/:page', controller.moment.timeline);
  // 我的朋友圈列表
  router.get('/moment/:page', controller.moment.list);
  // 将某个群成员踢出
  router.post('/group/kickoff', controller.group.kickoff);
  // 邀请加入群聊
  router.post('/group/invite', controller.group.invite);
  // 标签列表
  router.get('/tag/list', controller.tag.list);
  // 标签用户列表
  router.get('/tag/read/:id', controller.tag.read);
  // 验证群聊和当前用户的关系
  router.post('/group/checkrelation', controller.group.checkrelation);
  // 加入群聊
  router.post('/group/join', controller.group.join);
};
