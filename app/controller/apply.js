'use strict';

const Controller = require('egg').Controller;

class ApplyController extends Controller {
    // 申请添加好友
    async addFriend() {
        const { ctx, app } = this;
        // 拿到当前用户id
        let current_user_id = ctx.authUser.id;
        // 验证参数
        ctx.validate({
            friend_id: {
                type: 'int',
                required: true,
                desc: '好友id'
            },
            nickname: {
                type: 'string',
                required: false,
                desc: '昵称'
            },
            lookme: {
                type: 'int',
                required: true,
                range: {
                    in: [0, 1]
                },
                desc: '看我'
            },
            lookhim: {
                type: 'int',
                range: {
                    in: [0, 1]
                },
                required: true,
                desc: '看他'
            },
        });
        let { friend_id, nickname, lookme, lookhim } = ctx.request.body;
        // 不能添加自己
        if (current_user_id === friend_id) {
            ctx.throw(400, "不能添加自己");
        }
        // 对方是否存在
        let user = await app.model.User.findOne({
            where: {
                id: friend_id,
                status: 1
            }
        });
        if (!user) {
            ctx.throw(400, '该用户不存在或者已被禁用');
        }
        // 之前是否申请过了
        if (await app.model.Apply.findOne({
            where: {
                user_id: current_user_id,
                friend_id,
                status: ['pending', 'agree']
            }
        })) {
            ctx.throw(400, '你之前已经申请过了');
        }
        // 创建申请
        let apply = await app.model.Apply.create({
            user_id: current_user_id,
            friend_id,
            lookme,
            lookhim,
            nickname
        });
        if (!apply) {
            ctx.throw(400, '申请失败');
        }
        ctx.apiSuccess(apply);
        // 消息推送
        ctx.send(friend_id, '', "updateApplyList");
    }

    // 获取好友申请列表
    async list() {
        const { ctx, app } = this;
        let current_user_id = ctx.authUser.id;

        let page = ctx.params.page ? parseInt(ctx.params.page) : 1;
        let limit = ctx.query.limit ? parseInt(ctx.query.limit) : 10;
        let offset = (page - 1) * limit;

        let rows = await app.model.Apply.findAll({
            where: {
                friend_id: current_user_id,
            },
            include: [{
                model: app.model.User,
                attributes: ['id', 'username', 'nickname', 'avatar']
            }],
            offset,
            limit,
            order: [
                ['id', 'DESC']
            ]
        });

        let count = await app.model.Apply.count({
            where: {
                friend_id: current_user_id,
                status: "pending"
            }
        });

        ctx.apiSuccess({
            rows, count
        });
    }

    // 处理好友申请
    async handle() {
        const { ctx, app } = this;
        let current_user_id = ctx.authUser.id;
        let id = parseInt(ctx.params.id)
        // 参数验证
        ctx.validate({
            nickname: {
                type: 'string',
                required: false,
                desc: '昵称'
            },
            status: {
                type: 'string',
                required: true,
                range: {
                    in: ['refuse', 'agree', 'ignore']
                },
                desc: '处理结果'
            },
            lookme: {
                type: 'int',
                required: true,
                range: {
                    in: [0, 1]
                },
                desc: '看我'
            },
            lookhim: {
                type: 'int',
                range: {
                    in: [0, 1]
                },
                required: true,
                desc: '看他'
            },
        });
        // 查询该申请是否存在
        let apply = await app.model.Apply.findOne({
            where: {
                id,
                friend_id: current_user_id,
                status: "pending"
            },
            include: [{
                model: app.model.User
            }]
        });
        if (!apply) {
            ctx.throw(400, '该记录不存在');
        }
        let { status, nickname, lookme, lookhim } = ctx.request.body;
        let transaction;
        try {
            // 开启事务
            transaction = await app.model.transaction();

            // 设置该申请状态
            await apply.update({
                status
            }, { transaction });
            // 同意的话，添加到好友列表中
            if (status == 'agree') {
                // 加入到对方好友列表
                await app.model.Friend.create({
                    friend_id: current_user_id,
                    user_id: apply.user_id,
                    nickname: apply.nickname,
                    lookme: apply.lookme,
                    lookhim: apply.lookhim,
                }, { transaction });
                // 将对方加入到我的好友列表
                await app.model.Friend.create({
                    friend_id: apply.user_id,
                    user_id: current_user_id,
                    nickname,
                    lookme,
                    lookhim,
                }, { transaction });
            }
            // 提交事务
            await transaction.commit();
            // 消息推送
            if (status == 'agree') {
                let message = {
                    id: (new Date()).getTime(), // 唯一id，后端生成唯一id
                    from_avatar: ctx.authUser.avatar,// 发送者头像
                    from_name: apply.nickname || ctx.authUser.nickname || ctx.authUser.username, // 发送者昵称
                    from_id: current_user_id, // 发送者id
                    to_id: apply.user_id, // 接收人/群 id
                    to_name: nickname || apply.user.nickname || apply.user.username, // 接收人/群 名称
                    to_avatar: apply.user.avatar, // 接收人/群 头像
                    chat_type: 'user', // 接收类型
                    type: "system",// 消息类型
                    data: "你们已经是好友，可以开始聊天啦", // 消息内容
                    options: {}, // 其他参数
                    create_time: (new Date()).getTime(), // 创建时间
                    isremove: 0, // 是否撤回
                }
                ctx.sendAndSaveMessage(apply.user_id, { ...message });

                message.from_avatar = apply.user.avatar;
                message.from_name = nickname || apply.user.nickname || apply.user.username;
                message.from_id = apply.user.id;

                message.to_avatar = ctx.authUser.avatar;
                message.to_name = apply.nickname || ctx.authUser.nickname || ctx.authUser.username;
                message.to_id = current_user_id;

                ctx.sendAndSaveMessage(current_user_id, { ...message });
            }
            return ctx.apiSuccess('操作成功');
        } catch (e) {
            // 事务回滚
            await transaction.rollback();
            return ctx.apiFail('操作失败');
        }
    }

}

module.exports = ApplyController;
