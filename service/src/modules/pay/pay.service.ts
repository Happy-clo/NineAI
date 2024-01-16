import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpException, HttpStatus, Injectable, OnModuleInit } from '@nestjs/common';
import * as crypto from 'crypto';
import axios from 'axios';
import fs from 'fs';
import { OrderEntity } from '../order/order.entity';
import { CramiPackageEntity } from '../crami/cramiPackage.entity';
import { UserBalanceService } from '../userBalance/userBalance.service';
import { GlobalConfigService } from '../globalConfig/globalConfig.service';
import { createRandomNonceStr, importDynamic } from '@/common/utils';
import { UserService } from '../user/user.service';

@Injectable()
export class PayService {
  constructor(
    @InjectRepository(CramiPackageEntity)
    private readonly cramiPackageEntity: Repository<CramiPackageEntity>,
    @InjectRepository(OrderEntity)
    private readonly orderEntity: Repository<OrderEntity>,
    private readonly userBalanceService: UserBalanceService,
    private readonly globalConfigService: GlobalConfigService,
    private readonly userService: UserService,
  ) {}

  private WxPay;

  async onModuleInit() {
    const wpay = await importDynamic('wechatpay-node-v3');
    this.WxPay = wpay?.default ? wpay.default : wpay;
  }

  /* 支付通知 */
  async notify(params: object) {
    if (params['param'] == 'epay') {
      return this.notifyEpay(params);
    }
    if (params['attach'] == 'hupi') {
      return this.notifyHupi(params);
    }
    if (typeof params['resource'] == 'object') {
      return this.notifyWeChat(params);
    }
    return this.notifyMpay(params);
  }

  /* 分平台支付请求 */
  async pay(userId: number, orderId: string, payType = 'wxpay') {
    // query order
    const order = await this.orderEntity.findOne({ where: { userId, orderId } });
    if (!order) throw new HttpException('订单不存在!', HttpStatus.BAD_REQUEST);
    // query goods
    const goods = await this.cramiPackageEntity.findOne({ where: { id: order.goodsId } });
    if (!goods) throw new HttpException('套餐不存在!', HttpStatus.BAD_REQUEST);
    console.log('本次支付类型: ', order.payPlatform);
    try {
      if (order.payPlatform == 'wechat') {
        return this.payWeChat(userId, orderId, payType);
      }
      if (order.payPlatform == 'epay') {
        return this.payEpay(userId, orderId, payType);
      }
      if (order.payPlatform == 'mpay') {
        return this.payMpay(userId, orderId, payType);
      }
      if (order.payPlatform == 'hupi') {
        return this.payHupi(userId, orderId, payType);
      }
    } catch (error) {
      console.log('支付请求失败: ', error);
      throw new HttpException('支付请求失败!', HttpStatus.BAD_REQUEST);
    }
  }

  /* 支付订单状态查询 */
  async query(orderId: string) {
    const order = await this.orderEntity.findOne({ where: { orderId } });
    if (!order) throw new HttpException('订单不存在!', HttpStatus.BAD_REQUEST);
    return order;
  }

  /* 虎皮椒支付通知 */
  async notifyHupi(params: object) {
    const payHupiSecret = await this.globalConfigService.getConfigs(['payHupiSecret']);
    const hash = params['hash'];
    delete params['hash'];
    if (this.sign(params, payHupiSecret) != hash) return 'failed';
    const order = await this.orderEntity.findOne({ where: { orderId: params['trade_order_id'], status: 0 } });
    if (!order) return 'failed';
    /* add balance  log */
    await this.userBalanceService.addBalanceToOrder(order);
    const result = await this.orderEntity.update({ orderId: params['trade_order_id'] }, { status: 1, paydAt: new Date() });
    if (result.affected != 1) return 'failed';
    return 'success';
  }

  /* 虎皮椒支付 */
  async payHupi(userId: number, orderId: string, payType = 'wxpay') {
    const order = await this.orderEntity.findOne({ where: { userId, orderId } });
    if (!order) throw new HttpException('订单不存在!', HttpStatus.BAD_REQUEST);
    const goods = await this.cramiPackageEntity.findOne({ where: { id: order.goodsId } });
    if (!goods) throw new HttpException('套餐不存在!', HttpStatus.BAD_REQUEST);
    const { payHupiAppId, payHupiSecret, payHupiNotifyUrl, payHupiReturnUrl, payHupiGatewayUrl } = await this.globalConfigService.getConfigs([
      'payHupiAppId',
      'payHupiSecret',
      'payHupiNotifyUrl',
      'payHupiReturnUrl',
      'payHupiGatewayUrl'
    ]);
    const params = {};
    params['version'] = '1.1';
    params['appid'] = payHupiAppId;
    params['time'] = (Date.now() / 1000).toFixed(0);
    params['nonce_str'] = createRandomNonceStr(32);
    params['trade_order_id'] = orderId;
    params['title'] = goods.name;
    params['total_fee'] = order.total;
    params['notify_url'] = payHupiNotifyUrl;
    params['return_url'] = payHupiReturnUrl;
    params['attach'] = 'hupi';
    params['hash'] = this.sign(params, payHupiSecret);
    const {
      data: { errcode, errmsg, url_qrcode, url },
    } = await axios.post(payHupiGatewayUrl || 'https://api.xunhupay.com/payment/do.html', params);
    if (errcode != 0) throw new HttpException(errmsg, HttpStatus.BAD_REQUEST);
    return { url_qrcode, url };
  }

  /* 虎皮椒商户查询 */
  async queryHupi(orderId: string) {
    const { payHupiAppId, payHupiSecret } = await this.globalConfigService.getConfigs(['payHupiAppId', 'payHupiSecret']);
    const params = {};
    params['version'] = '1.1';
    params['appid'] = payHupiAppId;
    params['time'] = (Date.now() / 1000).toFixed(0);
    params['nonce_str'] = createRandomNonceStr(32);
    params['out_trade_order'] = orderId;
    params['hash'] = this.sign(params, payHupiSecret);
    const {
      data: { errcode, errmsg, data: result },
    } = await axios.post('https://api.xunhupay.com/payment/query.html', params);
    if (errcode != 0) throw new HttpException(errmsg, HttpStatus.BAD_REQUEST);
    return result;
  }

  /* 易支付支付结果通知 */
  async notifyEpay(params: object) {
    const sign = params['sign'];
    delete params['sign'];
    delete params['sign_type'];
    const payEpaySecret = await this.globalConfigService.getConfigs(['payEpaySecret']);
    if (this.sign(params, payEpaySecret) != sign) return 'failed';
    console.log('校验签名通过');
    const order = await this.orderEntity.findOne({ where: { orderId: params['out_trade_no'], status: 0 } });
    if (!order) return 'failed';
    // update order status
    const status = params['trade_status'] == 'TRADE_SUCCESS' ? 1 : 2;
    const result = await this.orderEntity.update({ orderId: params['out_trade_no'] }, { status, paydAt: new Date() });
    if (status === 1) {
      await this.userBalanceService.addBalanceToOrder(order);
    }
    if (result.affected != 1) return 'failed';
    return 'success';
  }

  /* 易支付支付 */
  async payEpay(userId: number, orderId: string, payType = 'alipay') {
    // query order
    const order = await this.orderEntity.findOne({ where: { userId, orderId } });
    if (!order) throw new HttpException('订单不存在!', HttpStatus.BAD_REQUEST);
    // query goods
    const goods = await this.cramiPackageEntity.findOne({ where: { id: order.goodsId } });
    if (!goods) throw new HttpException('套餐不存在!', HttpStatus.BAD_REQUEST);
    // assemble params
    const { payEpayPid, payEpaySecret, payEpayNotifyUrl, payEpayReturnUrl, payEpayApiPayUrl } = await this.globalConfigService.getConfigs([
      'payEpayPid',
      'payEpaySecret',
      'payEpayNotifyUrl',
      'payEpayReturnUrl',
      'payEpayApiPayUrl',
    ]);

    let convertedNumber;

    if (payEpayPid.length <= 16) {
      convertedNumber = Number(payEpayPid);
    } else {
      convertedNumber = BigInt(payEpayPid);
    }
    const params = {};
    params['pid'] = convertedNumber;
    params['type'] = payType;
    params['out_trade_no'] = orderId;
    params['name'] = goods.name;
    params['money'] = order.total;
    params['clientip'] = '192.168.1.100';
    params['device'] = 'pc';
    params['notify_url'] = payEpayNotifyUrl;
    params['return_url'] = payEpayReturnUrl;
    params['param'] = 'epay';
    params['sign'] = this.sign(params, payEpaySecret);
    params['sign_type'] = 'MD5';
    const queryParams = new URLSearchParams(params).toString();
    const apiUrl = `${payEpayApiPayUrl}?${queryParams}`;
    if (payEpayApiPayUrl.includes('submit.php')) {
      return { url_qrcode: null, redirectUrl: apiUrl, channel: payType, isRedirect: true };
    } else {
      const res = await axios.get(payEpayApiPayUrl, { params });
      console.log('epay ---> res: ', res.data);
      const {
        data: { code, msg, qrcode: url_qrcode },
      } = res;
      if (code != 1) throw new HttpException(msg, HttpStatus.BAD_REQUEST);
      return { url_qrcode, redirectUrl: null, channel: payType, isRedirect: false };
    }
  }

  /* 易支付商户信息查询 */
  async queryEpay(orderId: string) {
    const { payEpayPid, payEpaySecret, payEpayApiQueryUrl } = await this.globalConfigService.getConfigs([
      'payEpayPid',
      'payEpaySecret',
      'payEpayApiQueryUrl',
    ]);
    const params = {};
    params['act'] = 'order';
    params['out_trade_no'] = orderId;
    params['pid'] = payEpayPid;
    params['key'] = payEpaySecret;
    const {
      data: { code, msg, data: result },
    } = await axios.get(payEpayApiQueryUrl, { params });
    if (code != 1) throw new HttpException(msg, HttpStatus.BAD_REQUEST);
    return result;
  }

  /* 码支付支付结果通知 */
  async notifyMpay(params: object) {
    const sign = params['sign'];
    delete params['sign'];
    delete params['sign_type'];
    const payMpaySecret = await this.globalConfigService.getConfigs(['payMpaySecret']);
    console.log('校验签名');
    if (this.sign(params, payMpaySecret) != sign) return 'failed';
    console.log('校验签名通过');
    const order = await this.orderEntity.findOne({ where: { orderId: params['out_trade_no'], status: 0 } });
    if (!order) return 'failed';
    // update order status
    const status = params['trade_status'] == 'TRADE_SUCCESS' ? 1 : 2;
    console.log('status: ', status);
    const result = await this.orderEntity.update({ orderId: params['out_trade_no'] }, { status, paydAt: new Date() });
    if (status === 1) {
      await this.userBalanceService.addBalanceToOrder(order);
    }
    if (result.affected != 1) return 'failed';
    return 'success';
  }

  /* 码支付支付 */
  async payMpay(userId: number, orderId: string, payType = 'wxpay') {
    // query order
    const order = await this.orderEntity.findOne({ where: { userId, orderId } });
    if (!order) throw new HttpException('订单不存在!', HttpStatus.BAD_REQUEST);
    // query goods
    const goods = await this.cramiPackageEntity.findOne({ where: { id: order.goodsId } });
    if (!goods) throw new HttpException('套餐不存在!', HttpStatus.BAD_REQUEST);
    // assemble params
    const { payMpayPid, payMpaySecret, payMpayNotifyUrl, payMpayReturnUrl, payMpayApiPayUrl } = await this.globalConfigService.getConfigs([
      'payMpayPid',
      'payMpaySecret',
      'payMpayNotifyUrl',
      'payMpayReturnUrl',
      'payMpayApiPayUrl',
    ]);
    const params = {};
    params['pid'] = Number(payMpayPid);
    params['type'] = payType;
    params['out_trade_no'] = orderId;
    params['name'] = goods.name;
    params['money'] = order.total;
    params['notify_url'] = payMpayNotifyUrl;
    params['return_url'] = payMpayReturnUrl;
    // params['param'] = 'Mpay';
    params['sign'] = this.sign(params, payMpaySecret);
    params['sign_type'] = 'MD5';
    const queryParams = new URLSearchParams(params).toString();
    const apiUrl = `${payMpayApiPayUrl}?${queryParams}`;
    return { url_qrcode: null, redirectUrl: apiUrl, channel: payType, isRedirect: true };
    const res = await axios.get(payMpayApiPayUrl, { params });
  }

  /* 码支付商户信息查询 */
  async queryMpay(orderId: string) {
    const { payMpayApiQueryUrl } = await this.globalConfigService.getConfigs(['payMpayPid', 'payMpaySecret', 'payMpayApiQueryUrl']);
    const params = {};
    params['type'] = 2;
    params['order_no'] = orderId;
    const {
      data: { code, msg, data: result },
    } = await axios.get(payMpayApiQueryUrl, { params });
    if (code != 1) throw new HttpException(msg, HttpStatus.BAD_REQUEST);
    return result;
  }

  /* 微信支付结果通知 */
  async notifyWeChat(params: object) {
    console.log('微信支付通知params: ', params);
    // assemble params
    const { payWeChatAppId, payWeChatMchId, payWeChatSecret, payWeChatPublicKey, payWeChatPrivateKey } = await this.globalConfigService.getConfigs([
      'payWeChatAppId',
      'payWeChatMchId',
      'payWeChatSecret',
      'payWeChatPublicKey',
      'payWeChatPrivateKey',
    ]);
    const pay = new this.WxPay({
      appid: payWeChatAppId,
      mchid: payWeChatMchId,
      publicKey: payWeChatPublicKey,
      privateKey: payWeChatPrivateKey,
    });
    try {
      if (params['event_type'] == 'TRANSACTION.SUCCESS') {
        const { ciphertext, associated_data, nonce } = params['resource'];
        const resource = pay.decipher_gcm(ciphertext, associated_data, nonce, payWeChatSecret);
        const order = await this.orderEntity.findOne({ where: { orderId: resource['out_trade_no'], status: 0 } });
        if (!order) return 'failed';
        // update order status
        const status = resource['trade_state'] == 'SUCCESS' ? 1 : 2;
        const result = await this.orderEntity.update({ orderId: resource['out_trade_no'] }, { status, paydAt: new Date() });
        if (status === 1) {
          await this.userBalanceService.addBalanceToOrder(order);
        }
        if (result.affected != 1) return 'failed';
      }
      return 'success';
    } catch (error) {
      console.log('error: ', error);
      console.log('支付通知验证失败: ', error);
      return 'failed';
    }
  }

  /* 微信支付支付 */
  async payWeChat(userId: number, orderId: string, payType = 'native') {
    console.log('payType: ', payType);
    const order = await this.orderEntity.findOne({ where: { userId, orderId } });
    if (!order) throw new HttpException('订单不存在!', HttpStatus.BAD_REQUEST);
    const goods = await this.cramiPackageEntity.findOne({ where: { id: order.goodsId } });
    if (!goods) throw new HttpException('套餐不存在!', HttpStatus.BAD_REQUEST);
    const { payWeChatAppId, payWeChatMchId, payWeChatPublicKey, payWeChatPrivateKey, payWeChatNotifyUrl, payWeChatH5Name, payWeChatH5Url } =
      await this.globalConfigService.getConfigs([
        'payWeChatAppId',
        'payWeChatMchId',
        'payWeChatPublicKey',
        'payWeChatPrivateKey',
        'payWeChatNotifyUrl',
        'payWeChatH5Name',
        'payWeChatH5Url',
      ]);
    const pay = new this.WxPay({
      appid: payWeChatAppId,
      mchid: payWeChatMchId,
      publicKey: payWeChatPublicKey,
      privateKey: payWeChatPrivateKey,
    });
    const params: any = {
      appid: payWeChatAppId,
      mchid: payWeChatMchId,
      description: goods.name,
      out_trade_no: orderId,
      notify_url: payWeChatNotifyUrl,
      amount: {
        total: Number(order.total * 100),
      },
      // payer: null,
      scene_info: {
        payer_client_ip: '192.168.1.100',
        // h5_info: {
        //   type: 'Wap',
        //   app_name: payWeChatH5Name,
        //   app_url: payWeChatH5Url,
        // },
      },
    };
    console.log('wechat-pay: ', params);

    if (payType == 'h5') {
      params.scene_info.h5_info = {
        type: 'Wap',
        app_name: payWeChatH5Name,
        app_url: payWeChatH5Url,
      };
      const res = await pay.transactions_h5(params);
      if (res.status === 403) {
        const errmsg = res?.errRaw?.response?.text?.message;
        throw new HttpException(res?.message || '微信H5支付失败！', HttpStatus.BAD_REQUEST);
      }
      const { h5_url } = res;
      return { url: h5_url };
    }
    if (payType == 'jsapi') {
      // query openid
      const openid = await this.userService.getOpenIdByUserId(userId);
      console.log('用户openId: ', openid);
      params['payer'] = {
        openid: openid,
      };
      const result = await pay.transactions_jsapi(params);
      console.log('jsapi支付结果返回值: ', result);
      /*
      #   {
      #     appId: 'appid',
      #     timeStamp: '1609918952',
      #     nonceStr: 'y8aw9vrmx8c',
      #     package: 'prepay_id=wx0615423208772665709493edbb4b330000',
      #     signType: 'RSA',
      #     paySign: 'JnFXsT4VNzlcamtmgOHhziw7JqdnUS9qJ5W6vmAluk3Q2nska7rxYB4hvcl0BTFAB1PBEnHEhCsUbs5zKPEig=='
      #   } 
      */
      return result;
    }
    if (payType == 'native') {
      const res = await pay.transactions_native(params);
      const { code_url: url_qrcode } = res;
      if (!url_qrcode) {
        console.log('wx-native', res);
      }

      return { url_qrcode, isRedirect: false };
    }
    throw new HttpException('unsupported pay type', HttpStatus.BAD_REQUEST);
  }

  /* 微信支付商户信息查询 */
  async queryWeChat(orderId: string) {
    // assemble params
    const { payWeChatAppId, payWeChatMchId, payWeChatPublicKey, payWeChatPrivateKey, payWeChatNotifyUrl, payWeChatH5Name, payWeChatH5Url } =
      await this.globalConfigService.getConfigs(['payWeChatAppId', 'payWeChatMchId', 'payWeChatPublicKey', 'payWeChatPrivateKey']);
    const pay = new this.WxPay({
      appid: payWeChatAppId,
      mchid: payWeChatMchId,
      publicKey: payWeChatPublicKey,
      privateKey: payWeChatPrivateKey,
    });
    const result = await pay.query({ out_trade_no: orderId });
    return result;
  }

  /* 加密签名 */
  sign(params: object, secret: string) {
    const str =
      Object.keys(params)
        .sort()
        .map((key) => `${key}=${params[key]}`)
        .join('&') + secret;
    return crypto.createHash('md5').update(str).digest('hex');
  }
}
