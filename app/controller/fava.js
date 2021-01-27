'use strict';

const Controller = require('egg').Controller;

class FavaController extends Controller {
    // 创建收藏
    async create() {
        const { ctx, app } = this;
        let current_user_id = ctx.authUser.id;
        // 参数验证
        ctx.validate({
            type: {
                type: 'string',
                required: true,
                range: {
                    in: ['text', 'image', 'video', 'audio', 'emoticon', 'card']
                },
                desc: '消息类型'
            },
            data: {
                type: 'string',
                required: true,
                desc: '消息内容'
            },
            options: {
                type: 'string',
                required: true
            }
        });
        let { type, data, options } = ctx.request.body;
        await app.model.Fava.create({
            type, data, options,
            user_id: current_user_id
        });

        return ctx.apiSuccess('ok');

    }
    // 收藏列表
    async list() {
        const { ctx, app } = this;
        let current_user_id = ctx.authUser.id;

        let page = ctx.params.page ? parseInt(ctx.params.page) : 1;
        let limit = ctx.query.limit ? parseInt(ctx.query.limit) : 10;
        let offset = (page - 1) * limit;

        let rows = await app.model.Fava.findAll({
            where: {
                user_id: current_user_id
            },
            offset,
            limit,
            order: [
                ['id', 'DESC']
            ]
        });

        return ctx.apiSuccess(rows);
    }
    // 删除收藏
    async destroy() {
        const { ctx, app } = this;
        let current_user_id = ctx.authUser.id;

        ctx.validate({
            id: {
                type: "int",
                required: true
            }
        });

        let { id } = ctx.request.body;

        await app.model.Fava.destroy({
            where: {
                id,
                user_id: current_user_id
            }
        });

        return ctx.apiSuccess('ok');
    }
}

module.exports = FavaController;
