'use strict';

const Controller = require('egg').Controller;

class HomeController extends Controller {
  async index() {
    const { ctx } = this;
    let list = [{
      id: 1,
      name: "1"
    }, {
      id: 2,
      name: "2"
    }];

    ctx.apiSuccess(list);
  }
}

module.exports = HomeController;
