'use strict';

const Controller = require('egg').Controller;

class SearchController extends Controller {
    // 搜索用户
    async user() {
        const { ctx, app } = this;
        // 参数验证
        ctx.validate({
            keyword: {
                type: 'string',
                required: true,
                desc: '关键词'
            },
        });
        let { keyword } = ctx.request.body;
        let data = await app.model.User.findOne({
            where: {
                username: keyword
            },
            attributes: {
                exclude: ['password']
            }
        });
        ctx.apiSuccess(data);
    }
}

module.exports = SearchController;
