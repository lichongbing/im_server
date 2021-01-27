'use strict';

const Controller = require('egg').Controller;

class ReportController extends Controller {
    // 举报
    async save() {
        const { ctx, app } = this;
        let current_user_id = ctx.authUser.id;
        // 参数验证
        ctx.validate({
            reported_id: {
                type: 'int',
                required: true,
                desc: '被举报人id/群组id'
            },
            reported_type: {
                type: 'string',
                required: true,
                range: {
                    in: ['user', 'group']
                },
                desc: '举报类型'
            },
            content: {
                type: 'string',
                required: true,
                desc: '举报内容'
            },
            category: {
                type: 'string',
                required: true,
                desc: '分类'
            },
        });
        let { reported_id, reported_type, content, category } = ctx.request.body;
        // 不能举报自己
        if (reported_type == 'user' && reported_id === current_user_id) {
            ctx.throw(400, '不能举报自己');
        }
        // 被举报人是否存在
        if (!await app.model.User.findOne({
            where: {
                id: reported_id,
                status: 1
            }
        })) {
            ctx.throw(400, '被举报人不存在');
        }
        // 检查之前是否举报过（还未处理）
        if (await app.model.Report.findOne({
            where: {
                reported_id,
                reported_type,
                status: "pending"
            }
        })) {
            ctx.throw(400, '请勿反复提交');
        }
        // 创建举报内容
        let res = await app.model.Report.create({
            user_id: current_user_id,
            reported_id, reported_type, content, category
        });
        ctx.apiSuccess(res);
    }
}

module.exports = ReportController;
