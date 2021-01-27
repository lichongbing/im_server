/* eslint valid-jsdoc: "off" */

'use strict';

/**
 * @param {Egg.EggAppInfo} appInfo app info
 */
module.exports = appInfo => {
  /**
   * built-in config
   * @type {Egg.EggAppConfig}
   **/
  const config = exports = {};

  // use for cookie sign key, should change to your own and keep security
  config.keys = appInfo.name + '_1581589770017_1289';

  // add your middleware config here
  config.middleware = ['errorHandler', 'auth'];

  // add your user config here
  const userConfig = {
    // myAppName: 'egg',
  };

  config.auth = {
    ignore: ['/reg', '/login', '/ws']
  };


  config.security = {
    // 关闭 csrf
    csrf: {
      enable: false,
    },
    // 跨域白名单
    domainWhiteList: ['http://localhost:8080'],
  };
  // 允许跨域的方法
  config.cors = {
    origin: '*',
    allowMethods: 'GET, PUT, POST, DELETE, PATCH'
  };

  // 配置数据库
  config.sequelize = {
    dialect: 'mysql',
    host: '127.0.0.1',
    username: 'root',
    password: 'root',
    port: 3306,
    database: 'egg-wechat2',
    // 中国时区
    timezone: '+08:00',
    define: {
      // 取消数据表名复数
      freezeTableName: true,
      // 自动写入时间戳 created_at updated_at
      timestamps: true,
      // 字段生成软删除时间戳 deleted_at
      // paranoid: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      // deletedAt: 'deleted_at',
      // 所有驼峰命名格式化
      underscored: true
    }
  };

  // 参数验证
  config.valparams = {
    locale: 'zh-cn',
    throwError: true
  };

  // 加密
  config.crypto = {
    secret: 'qhdgw@45ncashdaksh2!#@3nxjdas*_672'
  };

  // jwt鉴权
  exports.jwt = {
    secret: 'qhdgw@45ncashdaksh2!#@3nxjdas*_672'
  };

  // redis
  config.redis = {
    client: {
      port: 6379,          // Redis port
      host: '127.0.0.1',   // Redis host
      password: '',
      db: 0,
    },
  }


  config.multipart = {
    mode: 'file',
    fileSize: 1048576000
  };

  // oss存储
  config.oss = {
    client: {
      accessKeyId: 'LTAImXhhE9wnecVo',
      accessKeySecret: '7Sm0RYNwZQ6oF661v0LHAKY27dOCZ5',
      bucket: 'tangzhe123-com',
      endpoint: 'oss-cn-shenzhen.aliyuncs.com',
      timeout: '60s',
    },
  }


  return {
    ...config,
    ...userConfig,
  };
};
