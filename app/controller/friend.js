'use strict';

const Controller = require('egg').Controller;
const SortWord = require('sort-word');
class FriendController extends Controller {
    // 通讯录
    async list() {
        const { ctx, app } = this;
        let current_user_id = ctx.authUser.id;
        // 获取并统计我的好友
        let friends = await app.model.Friend.findAndCountAll({
            where: {
                user_id: current_user_id
            },
            include: [{
                model: app.model.User,
                as: "friendInfo",
                attributes: ['id', 'username', 'nickname', 'avatar']
            }]
        });

        let res = friends.rows.map(item => {
            let name = item.friendInfo.nickname ? item.friendInfo.nickname : item.friendInfo.username;
            if (item.nickname) {
                name = item.nickname
            }
            return {
                id: item.id,
                user_id: item.friendInfo.id,
                name,
                username: item.friendInfo.username,
                avatar: item.friendInfo.avatar
            }
        });

        // 排序
        if (res.length > 0) {
            friends.rows = new SortWord(res, 'name');
        }

        ctx.apiSuccess(friends);
    }

    // 查看用户资料
    async read() {
        const { ctx, app } = this;
        let current_user_id = ctx.authUser.id;

        let user_id = ctx.params.id ? parseInt(ctx.params.id) : 0;

        let user = await app.model.User.findOne({
            where: {
                id: user_id,
                status: 1
            },
            attributes: {
                exclude: ['password']
            },
            include: [{
                model: app.model.Moment,
                order: [
                    ['id', 'desc']
                ],
                limit: 1
            }]
        });

        if (!user) {
            ctx.throw(400, '用户不存在');
        }


        let res = {
            id: user.id,
            username: user.username,
            nickname: user.nickname ? user.nickname : user.username,
            avatar: user.avatar,
            sex: user.sex,
            sign: user.sign,
            area: user.area,
            friend: false
        }

        let friend = await app.model.Friend.findOne({
            where: {
                friend_id: user_id,
                user_id: current_user_id
            },
            include: [{
                model: app.model.Tag,
                attributes: ['name']
            }]
        });

        if (friend) {
            res.friend = true
            if (friend.nickname) {
                res.nickname = friend.nickname;
            }
            res = {
                ...res,
                lookme: friend.lookme,
                lookhim: friend.lookhim,
                star: friend.star,
                isblack: friend.isblack,
                tags: friend.tags.map(item => item.name),
                moments: user.moments
            };
        }

        ctx.apiSuccess(res);
    }

    // 移入/移除黑名单
    async setblack() {
        const { ctx, app } = this;
        let current_user_id = ctx.authUser.id;
        let id = ctx.params.id ? parseInt(ctx.params.id) : 0;
        // 参数验证
        ctx.validate({
            isblack: {
                type: 'int',
                range: {
                    in: [0, 1]
                },
                required: true,
                desc: '移入/移除黑名单'
            },
        });

        let friend = await app.model.Friend.findOne({
            where: {
                friend_id: id,
                user_id: current_user_id
            }
        });
        if (!friend) {
            ctx.throw(400, '该记录不存在');
        }

        friend.isblack = ctx.request.body.isblack;
        await friend.save();

        ctx.apiSuccess('ok');
    }

    // 设置/取消星标好友
    async setstar() {
        const { ctx, app } = this;
        let current_user_id = ctx.authUser.id;
        let id = ctx.params.id ? parseInt(ctx.params.id) : 0;
        // 参数验证
        ctx.validate({
            star: {
                type: 'int',
                range: {
                    in: [0, 1]
                },
                required: true,
                desc: '设置/取消星标好友'
            },
        });

        let friend = await app.model.Friend.findOne({
            where: {
                friend_id: id,
                user_id: current_user_id,
                isblack: 0
            }
        });

        if (!friend) {
            ctx.throw(400, '该记录不存在');
        }

        friend.star = ctx.request.body.star;
        await friend.save();

        ctx.apiSuccess('ok');
    }

    // 设置朋友圈权限
    async setMomentAuth() {
        const { ctx, app } = this;
        let current_user_id = ctx.authUser.id;
        let id = ctx.params.id ? parseInt(ctx.params.id) : 0;

        // 参数验证
        ctx.validate({
            lookme: {
                type: 'int',
                range: {
                    in: [0, 1]
                },
                required: true
            },
            lookhim: {
                type: 'int',
                range: {
                    in: [0, 1]
                },
                required: true
            },
        });

        let friend = await app.model.Friend.findOne({
            where: {
                user_id: current_user_id,
                friend_id: id,
                isblack: 0
            }
        });
        if (!friend) {
            ctx.throw(400, '该记录不存在');
        }
        let { lookme, lookhim } = ctx.request.body;
        friend.lookhim = lookhim;
        friend.lookme = lookme;

        await friend.save();

        ctx.apiSuccess('ok');
    }

    // 设置备注和标签
    async setremarkTag() {
        const { ctx, app } = this;
        let current_user_id = ctx.authUser.id;
        let id = ctx.params.id ? parseInt(ctx.params.id) : 0;
        // 参数验证
        ctx.validate({
            nickname: {
                type: 'string',
                required: false,
                desc: "昵称"
            },
            tags: {
                type: 'string',
                required: true,
                desc: "标签"
            },
        });
        // 查看该好友是否存在
        let friend = await app.model.Friend.findOne({
            where: {
                user_id: current_user_id,
                friend_id: id,
                isblack: 0
            },
            include: [{
                model: app.model.Tag
            }]
        });
        if (!friend) {
            ctx.throw(400, '该记录不存在');
        }

        let { tags, nickname } = ctx.request.body;
        // // 设置备注
        friend.nickname = nickname;
        await friend.save();

        // 获取当前用户所有标签
        let allTags = await app.model.Tag.findAll({
            where: {
                user_id: current_user_id
            }
        });

        let allTagsName = allTags.map(item => item.name);

        // 新标签
        let newTags = tags.split(',');

        // 需要添加的标签
        let addTags = newTags.filter(item => !allTagsName.includes(item));
        addTags = addTags.map(name => {
            return {
                name,
                user_id: current_user_id
            }
        });
        // 写入tag表
        let resAddTags = await app.model.Tag.bulkCreate(addTags);

        // 找到新标签的id
        newTags = await app.model.Tag.findAll({
            where: {
                user_id: current_user_id,
                name: newTags
            }
        });

        let oldTagsIds = friend.tags.map(item => item.id);
        let newTagsIds = newTags.map(item => item.id);

        let addTagsIds = newTagsIds.filter(id => !oldTagsIds.includes(id));
        let delTagsIds = oldTagsIds.filter(id => !newTagsIds.includes(id));

        // 添加关联关系
        addTagsIds = addTagsIds.map(tag_id => {
            return {
                tag_id,
                friend_id: friend.id
            }
        });

        app.model.FriendTag.bulkCreate(addTagsIds);

        // 删除关联关系
        app.model.FriendTag.destroy({
            where: {
                tag_id: delTagsIds,
                friend_id: friend.id
            }
        });

        ctx.apiSuccess('ok');
    }
    // 删除好友
    async destroy() {
        const { ctx, app } = this;
        let current_user_id = ctx.authUser.id;

        ctx.validate({
            friend_id: {
                type: "int",
                required: true,
                desc: "好友id"
            }
        });
        let { friend_id } = ctx.request.body;
        await app.model.Friend.destroy({
            where: {
                user_id: current_user_id,
                friend_id
            }
        });

        ctx.apiSuccess('ok');

        app.model.Friend.destroy({
            where: {
                user_id: friend_id,
                friend_id: current_user_id
            }
        });

        this.deleteTimeLineMoment(friend_id, current_user_id);
        this.deleteTimeLineMoment(current_user_id, friend_id);

        // 删除apply表对应数据
        app.model.Apply.destroy({
            where: {
                user_id: current_user_id,
                friend_id: friend_id
            }
        });
    }

    // 删除非好友的朋友圈时间轴记录
    async deleteTimeLineMoment(friend_id, user_id) {
        const { app, ctx } = this;

        let moments = await app.model.Moment.findAll({
            where: {
                user_id: friend_id
            },
            attributes: ['id']
        });

        moments = moments.map(item => item.id);

        await app.model.MomentTimeline.destroy({
            where: {
                user_id,
                moment_id: moments
            }
        });
    }
}

module.exports = FriendController;
