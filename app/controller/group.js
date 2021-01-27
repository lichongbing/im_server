'use strict';

const Controller = require('egg').Controller;

class GroupController extends Controller {
    // 获取群聊列表
    async list() {
        const { ctx, app } = this;
        let current_user_id = ctx.authUser.id;

        let page = ctx.params.page ? parseInt(ctx.params.page) : 1;
        let limit = ctx.query.limit ? parseInt(ctx.query.limit) : 10;
        let offset = (page - 1) * limit;

        let rows = await app.model.Group.findAll({
            where: {
                status: 1
            },
            include: [{
                model: app.model.GroupUser,
                where: {
                    user_id: current_user_id
                }
            }]
        });

        return ctx.apiSuccess(rows);
    }
    // 创建群聊
    async create() {
        const { ctx, app } = this;
        let current_user_id = ctx.authUser.id;
        // 验证参数
        ctx.validate({
            ids: {
                required: true,
                type: 'array',
            }
        });
        let { ids } = ctx.request.body;
        // 验证是否是我的好友
        let friends = await app.model.Friend.findAll({
            where: {
                user_id: current_user_id,
                friend_id: ids
            },
            include: [{
                model: app.model.User,
                as: "friendInfo",
                attributes: ['nickname', 'username']
            }]
        });
        if (!friends.length) {
            return ctx.apiFail('请选择需要加入群聊的好友');
        }
        // 创建群聊
        let name = friends.map(item => item.friendInfo.nickname || item.friendInfo.username);
        name.push(ctx.authUser.nickname || ctx.authUser.username);
        let group = await app.model.Group.create({
            name: name.join(','),
            avatar: "",
            user_id: current_user_id
        });
        // 加入群聊用户
        let data = friends.map(item => {
            return {
                user_id: item.friend_id,
                group_id: group.id
            }
        });
        data.unshift({
            user_id: current_user_id,
            group_id: group.id
        });
        await app.model.GroupUser.bulkCreate(data);
        // 消息推送
        let message = {
            id: (new Date()).getTime(), // 唯一id，后端生成唯一id
            from_avatar: ctx.authUser.avatar,// 发送者头像
            from_name: ctx.authUser.nickname || ctx.authUser.username, // 发送者昵称
            from_id: current_user_id, // 发送者id
            to_id: group.id, // 接收人/群 id
            to_name: group.name, // 接收人/群 名称
            to_avatar: group.avatar, // 接收人/群 头像
            chat_type: 'group', // 接收类型
            type: "system",// 消息类型
            data: "创建群聊成功，可以开始聊天啦", // 消息内容
            options: {}, // 其他参数
            create_time: (new Date()).getTime(), // 创建时间
            isremove: 0, // 是否撤回
            group: group
        }
        data.forEach(item => {
            ctx.sendAndSaveMessage(item.user_id, message);
        });

        ctx.apiSuccess('ok');
    }

    // 查看群资料
    async info() {
        const { ctx, app } = this;
        let current_user_id = ctx.authUser.id;
        // 验证参数
        ctx.validate({
            id: {
                required: true,
                type: 'int',
                desc: "群组id"
            }
        });
        let { id } = ctx.params;
        // 群组是否存在
        let group = await app.model.Group.findOne({
            where: {
                status: 1,
                id
            },
            include: [{
                model: app.model.GroupUser,
                attributes: ['user_id', 'nickname'],
                include: [{
                    model: app.model.User,
                    attributes: ['id', 'nickname', 'avatar', 'username']
                }]
            }]
        });

        if (!group) {
            return ctx.apiFail('该群聊不存在或者已被封禁');
        }

        // 当前用户是否是该群成员
        let index = group.group_users.findIndex(item => item.user_id === current_user_id);
        if (index === -1) {
            return ctx.apiFail('你不是该群成员，没有权限');
        }

        ctx.apiSuccess(group);
    }

    // 修改群名称
    async rename() {
        const { ctx, app } = this;
        let current_user_id = ctx.authUser.id;
        // 参数验证
        ctx.validate({
            id: {
                required: true,
                type: 'int',
                desc: "群组id"
            },
            name: {
                required: true,
                type: 'string',
                desc: "群名称"
            }
        });
        let { id, name } = ctx.request.body;
        // 是否存在
        let group = await app.model.Group.findOne({
            where: {
                id,
                status: 1
            },
            include: [{
                model: app.model.GroupUser,
                attributes: ['user_id', 'nickname']
            }]
        });
        if (!group) {
            return ctx.apiFail('该群聊不存在或者已被封禁');
        }
        // 你是否是该群成员
        let index = group.group_users.findIndex(item => item.user_id === current_user_id);
        if (index === -1) {
            return ctx.apiFail('你不是该群成员');
        }
        // 验证是否是群主
        if (group.user_id !== current_user_id) {
            return ctx.apiFail('你不是管理员，没有权限');
        }
        // 修改群名称
        group.name = name;
        await group.save();
        // 消息推送
        let from_name = group.group_users[index].nickname || ctx.authUser.nickname || ctx.authUser.username;
        let message = {
            id: (new Date()).getTime(), // 唯一id，后端生成唯一id
            from_avatar: ctx.authUser.avatar,// 发送者头像
            from_name, // 发送者昵称
            from_id: current_user_id, // 发送者id
            to_id: group.id, // 接收人/群 id
            to_name: group.name, // 接收人/群 名称
            to_avatar: group.avatar, // 接收人/群 头像
            chat_type: 'group', // 接收类型
            type: "system",// 消息类型
            data: `${from_name} 修改群名称为 ${name}`, // 消息内容
            options: {}, // 其他参数
            create_time: (new Date()).getTime(), // 创建时间
            isremove: 0, // 是否撤回
            group: group
        }
        // 推送消息
        group.group_users.forEach(item => {
            ctx.sendAndSaveMessage(item.user_id, message);
        });
        ctx.apiSuccess('ok');
    }

    // 推送群公告
    async remark() {
        const { ctx, app } = this;
        let current_user_id = ctx.authUser.id;
        // 参数验证
        ctx.validate({
            id: {
                required: true,
                type: 'int',
                desc: "群组id"
            },
            remark: {
                required: true,
                type: 'string',
                desc: "群公告"
            }
        });
        let { id, remark } = ctx.request.body;
        // 是否存在
        let group = await app.model.Group.findOne({
            where: {
                id,
                status: 1
            },
            include: [{
                model: app.model.GroupUser,
                attributes: ['user_id', 'nickname']
            }]
        });
        if (!group) {
            return ctx.apiFail('该群聊不存在或者已被封禁');
        }
        // 你是否是该群成员
        let index = group.group_users.findIndex(item => item.user_id === current_user_id);
        if (index === -1) {
            return ctx.apiFail('你不是该群成员');
        }
        // 验证是否是群主
        if (group.user_id !== current_user_id) {
            return ctx.apiFail('你不是管理员，没有权限');
        }
        // 修改群公告
        group.remark = remark;
        await group.save();
        // 消息推送
        let from_name = group.group_users[index].nickname || ctx.authUser.nickname || ctx.authUser.username;
        let message = {
            id: (new Date()).getTime(), // 唯一id，后端生成唯一id
            from_avatar: ctx.authUser.avatar,// 发送者头像
            from_name, // 发送者昵称
            from_id: current_user_id, // 发送者id
            to_id: group.id, // 接收人/群 id
            to_name: group.name, // 接收人/群 名称
            to_avatar: group.avatar, // 接收人/群 头像
            chat_type: 'group', // 接收类型
            type: "system",// 消息类型
            data: `[新公告] ${remark}`, // 消息内容
            options: {}, // 其他参数
            create_time: (new Date()).getTime(), // 创建时间
            isremove: 0, // 是否撤回
            group: group
        }
        // 推送消息
        group.group_users.forEach(item => {
            ctx.sendAndSaveMessage(item.user_id, message);
        });
        ctx.apiSuccess('ok');
    }

    // 修改我在本群中的昵称
    async nickname() {
        const { ctx, app } = this;
        let current_user_id = ctx.authUser.id;
        // 参数验证
        ctx.validate({
            id: {
                required: true,
                type: 'int',
                desc: "群组id"
            },
            nickname: {
                required: false,
                type: 'string',
                desc: "昵称",
                defValue: ""
            }
        });
        let { id, nickname } = ctx.request.body;
        // 是否存在
        let group = await app.model.Group.findOne({
            where: {
                id,
                status: 1
            },
            include: [{
                model: app.model.GroupUser,
                attributes: ['user_id', 'nickname']
            }]
        });
        if (!group) {
            return ctx.apiFail('该群聊不存在或者已被封禁');
        }
        // 你是否是该群成员
        let index = group.group_users.findIndex(item => item.user_id === current_user_id);
        if (index === -1) {
            return ctx.apiFail('你不是该群成员');
        }
        // 修改昵称
        let group_user = await app.model.GroupUser.findOne({
            where: {
                user_id: current_user_id,
                group_id: group.id
            }
        });
        if (group_user) {
            await group_user.update({
                nickname
            });
        }
        return ctx.apiSuccess('ok');
    }

    // 删除并退出群聊
    async quit() {
        const { ctx, app } = this;
        let current_user_id = ctx.authUser.id;
        // 参数验证
        ctx.validate({
            id: {
                required: true,
                type: 'int',
                desc: "群组id"
            }
        });
        let { id } = ctx.request.body;
        // 是否存在
        let group = await app.model.Group.findOne({
            where: {
                id,
            },
            include: [{
                model: app.model.GroupUser,
                attributes: ['user_id', 'nickname']
            }]
        });
        if (!group) {
            return ctx.apiFail('该群聊不存在');
        }
        // 你是否是该群成员
        let index = group.group_users.findIndex(item => item.user_id === current_user_id);
        if (index === -1) {
            return ctx.apiFail('你不是该群成员');
        }

        let from_name = group.group_users[index].nickname || ctx.authUser.nickname || ctx.authUser.username;

        let message = {
            id: (new Date()).getTime(), // 唯一id，后端生成唯一id
            from_avatar: ctx.authUser.avatar,// 发送者头像
            from_name, // 发送者昵称
            from_id: current_user_id, // 发送者id
            to_id: group.id, // 接收人/群 id
            to_name: group.name, // 接收人/群 名称
            to_avatar: group.avatar, // 接收人/群 头像
            chat_type: 'group', // 接收类型
            type: "system",// 消息类型
            data: '', // 消息内容
            options: {}, // 其他参数
            create_time: (new Date()).getTime(), // 创建时间
            isremove: 0, // 是否撤回
            group: group
        }

        if (group.user_id === current_user_id) {
            // 解散群
            await app.model.Group.destroy({
                where: {
                    id: group.id
                }
            });
            message.data = '该群已被解散';
        } else {
            // 退出群
            await app.model.GroupUser.destroy({
                where: {
                    user_id: current_user_id,
                    group_id: group.id
                }
            });
            message.data = `${from_name} 退出该群聊`;
        }

        // 推送消息
        group.group_users.forEach(item => {
            ctx.sendAndSaveMessage(item.user_id, message);
        });

        return ctx.apiSuccess('ok');
    }
    // 生成群二维码
    async qrcode() {
        const { ctx, app } = this;
        ctx.qrcode(JSON.stringify({
            id: ctx.params.id,
            type: "group",
            event: "navigateTo"
        }));
    }
    // 踢出某个群成员
    async kickoff() {
        const { ctx, app } = this;
        let current_user_id = ctx.authUser.id;
        // 参数验证
        ctx.validate({
            id: {
                required: true,
                type: 'int',
                desc: "群组id"
            },
            user_id: {
                required: true,
                type: 'int',
                desc: "用户id"
            }
        });
        let { id, user_id } = ctx.request.body;
        // 是否存在
        let group = await app.model.Group.findOne({
            where: {
                id,
                status: 1
            },
            include: [{
                model: app.model.GroupUser,
                attributes: ['user_id', 'nickname'],
                include: [{
                    model: app.model.User,
                    attributes: ['username', 'nickname'],
                }]
            }]
        });
        if (!group) {
            return ctx.apiFail('该群聊不存在或者已被封禁');
        }
        // 你是否是该群成员
        let index = group.group_users.findIndex(item => item.user_id === current_user_id);
        if (index === -1) {
            return ctx.apiFail('你不是该群成员');
        }
        // 验证是否是群主
        if (group.user_id !== current_user_id) {
            return ctx.apiFail('你不是管理员，没有权限');
        }
        // 不能踢自己
        if (user_id === current_user_id) {
            return ctx.apiFail('不能踢自己');
        }
        // 对方不是该群成员
        let index2 = group.group_users.findIndex(item => item.user_id === user_id);
        if (index2 === -1) {
            return ctx.apiFail('对方不是该群成员');
        }
        let kickname = group.group_users[index2].nickname || group.group_users[index2].user.nickname || group.group_users[index2].user.username;
        // 踢出该群
        await app.model.GroupUser.destroy({
            where: {
                user_id: user_id,
                group_id: group.id
            }
        });
        // 返回成功
        ctx.apiSuccess('ok');
        // 构建消息格式
        let from_name = group.group_users[index].nickname || ctx.authUser.nickname || ctx.authUser.username;
        let message = {
            id: (new Date()).getTime(), // 唯一id，后端生成唯一id
            from_avatar: ctx.authUser.avatar,// 发送者头像
            from_name, // 发送者昵称
            from_id: current_user_id, // 发送者id
            to_id: group.id, // 接收人/群 id
            to_name: group.name, // 接收人/群 名称
            to_avatar: group.avatar, // 接收人/群 头像
            chat_type: 'group', // 接收类型
            type: "system",// 消息类型
            data: `${from_name} 将 ${kickname} 移出群聊`, // 消息内容
            options: {}, // 其他参数
            create_time: (new Date()).getTime(), // 创建时间
            isremove: 0, // 是否撤回
            group: group
        }
        // 消息推送
        group.group_users.forEach(item => {
            ctx.sendAndSaveMessage(item.user_id, message);
        });
    }

    // 邀请加入群聊
    async invite() {
        const { ctx, app } = this;
        let current_user_id = ctx.authUser.id;
        // 参数验证
        ctx.validate({
            id: {
                required: true,
                type: 'int',
                desc: "群组id"
            },
            user_id: {
                required: true,
                type: 'int',
                desc: "用户id"
            }
        });
        let { id, user_id } = ctx.request.body;
        // 是否存在
        let group = await app.model.Group.findOne({
            where: {
                id,
                status: 1
            },
            include: [{
                model: app.model.GroupUser,
                attributes: ['user_id', 'nickname'],
                include: [{
                    model: app.model.User,
                    attributes: ['username', 'nickname'],
                }]
            }]
        });
        if (!group) {
            return ctx.apiFail('该群聊不存在或者已被封禁');
        }
        // 你是否是该群成员
        let index = group.group_users.findIndex(item => item.user_id === current_user_id);
        if (index === -1) {
            return ctx.apiFail('你不是该群成员');
        }
        // 对方已经是该群成员
        let index2 = group.group_users.findIndex(item => item.user_id === user_id);
        if (index2 !== -1) {
            return ctx.apiFail('对方已经是该群成员');
        }
        // 对方是否存在
        let user = await app.model.User.findOne({
            where: {
                id: user_id,
                status: 1
            }
        });
        if (!user) {
            return ctx.apiFail('对方不存在或者已被封禁');
        }
        let invitename = user.nickname || user.username;
        // 加入该群
        await app.model.GroupUser.create({
            user_id: user_id,
            group_id: group.id
        });
        // 返回成功
        ctx.apiSuccess('ok');
        // 构建消息格式
        let from_name = group.group_users[index].nickname || ctx.authUser.nickname || ctx.authUser.username;
        let message = {
            id: (new Date()).getTime(), // 唯一id，后端生成唯一id
            from_avatar: ctx.authUser.avatar,// 发送者头像
            from_name, // 发送者昵称
            from_id: current_user_id, // 发送者id
            to_id: group.id, // 接收人/群 id
            to_name: group.name, // 接收人/群 名称
            to_avatar: group.avatar, // 接收人/群 头像
            chat_type: 'group', // 接收类型
            type: "system",// 消息类型
            data: `${from_name} 邀请 ${invitename} 加入群聊`, // 消息内容
            options: {}, // 其他参数
            create_time: (new Date()).getTime(), // 创建时间
            isremove: 0, // 是否撤回
            group: group
        }
        // 消息推送
        group.group_users.forEach(item => {
            ctx.sendAndSaveMessage(item.user_id, message);
        });
    }

    // 加入群聊
    async join() {
        const { ctx, app } = this;
        let current_user_id = ctx.authUser.id;
        // 参数验证
        ctx.validate({
            id: {
                required: true,
                type: 'int',
                desc: "群组id"
            },
        });
        let { id } = ctx.request.body;
        // 是否存在
        let group = await app.model.Group.findOne({
            where: {
                id,
                status: 1
            },
            include: [{
                model: app.model.GroupUser,
                attributes: ['user_id', 'nickname'],
                include: [{
                    model: app.model.User,
                    attributes: ['username', 'nickname'],
                }]
            }]
        });
        if (!group) {
            return ctx.apiFail('该群聊不存在或者已被封禁');
        }
        // 你是否是该群成员
        let index = group.group_users.findIndex(item => item.user_id === current_user_id);
        if (index !== -1) {
            return ctx.apiFail('你已经是该群成员');
        }
        // 加入该群
        await app.model.GroupUser.create({
            user_id: current_user_id,
            group_id: group.id
        });
        // 返回成功
        ctx.apiSuccess('ok');
        // 构建消息格式
        let from_name = ctx.authUser.nickname || ctx.authUser.username;
        let message = {
            id: (new Date()).getTime(), // 唯一id，后端生成唯一id
            from_avatar: ctx.authUser.avatar,// 发送者头像
            from_name, // 发送者昵称
            from_id: current_user_id, // 发送者id
            to_id: group.id, // 接收人/群 id
            to_name: group.name, // 接收人/群 名称
            to_avatar: group.avatar, // 接收人/群 头像
            chat_type: 'group', // 接收类型
            type: "system",// 消息类型
            data: `${from_name} 加入群聊`, // 消息内容
            options: {}, // 其他参数
            create_time: (new Date()).getTime(), // 创建时间
            isremove: 0, // 是否撤回
            group: group
        }
        // 消息推送
        group.group_users.forEach(item => {
            ctx.sendAndSaveMessage(item.user_id, message);
        });

        ctx.sendAndSaveMessage(current_user_id, message);
    }

    async checkrelation() {
        const { ctx, app } = this;
        let current_user_id = ctx.authUser.id;
        // 验证参数
        ctx.validate({
            id: {
                required: true,
                type: 'int',
                desc: "群组id"
            }
        });
        let id = ctx.request.body.id;
        // 群组是否存在
        let group = await app.model.Group.findOne({
            where: {
                status: 1,
                id
            },
            include: [{
                model: app.model.GroupUser,
                attributes: ['user_id', 'nickname'],
                include: [{
                    model: app.model.User,
                    attributes: ['id', 'nickname', 'avatar', 'username']
                }]
            }]
        });

        if (!group) {
            return ctx.apiFail('该群聊不存在或者已被封禁');
        }

        // 当前用户是否是该群成员
        let index = group.group_users.findIndex(item => item.user_id === current_user_id);
        if (index === -1) {
            return ctx.apiSuccess({
                status: false,
                group: {
                    id: group.id,
                    name: group.name,
                    avatar: group.avatar,
                    users_count: group.group_users.length,
                }
            });
        }

        ctx.apiSuccess({
            status: true,
            group: {
                id: group.id,
                name: group.name,
                avatar: group.avatar,
                users_count: group.group_users.length,
            }
        });
    }
}

module.exports = GroupController;
