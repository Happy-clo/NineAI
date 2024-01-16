import { RedisCacheService } from '@/modules/redisCache/redisCache.service';
import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import * as jwt from 'jsonwebtoken';
import { ModuleRef } from '@nestjs/core';
import { GlobalConfigService } from '@/modules/globalConfig/globalConfig.service';
import { atob, copyRightMsg, getRandomItemFromArray } from '../utils';
import { AuthService } from '../../modules/auth/auth.service';
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private redisCacheService: RedisCacheService,
    private readonly moduleRef: ModuleRef,
    private readonly globalConfigService: GlobalConfigService,
    private readonly authService: AuthService,
  ) {
    super();
  }

  async canActivate(context) {
    if (!this.redisCacheService) {
      this.redisCacheService = this.moduleRef.get(RedisCacheService, { strict: false });
    }
    const request = context.switchToHttp().getRequest();
    // TODO 域名检测
    const domain = request.headers['x-website-domain'];
    const token = this.extractToken(request);
    request.user = this.validateToken(token);
    const auth = this.globalConfigService.getNineAiToken();
    await this.redisCacheService.checkTokenAuth(token, request);
    return true;
  }

  private extractToken(request) {
    if (!request.headers.authorization) {
      if (request.headers.fingerprint) {
        let id = request.headers.fingerprint;
        /* 超过mysql最大值进行截取 */
        if (id > 2147483647) {
          id = id.toString().slice(-9);
          id = Number(String(Number(id)));
        }
        const token = this.authService.createTokenFromFingerprint(id);
        return token;
      }
      return null;
    }
    const parts = request.headers.authorization.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }
    return parts[1];
  }

  private validateToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      throw new HttpException('亲爱的用户,请登录后继续操作,我们正在等您的到来！', HttpStatus.UNAUTHORIZED);
    }
  }

  handleRequest(err, user, info) {
    if (err || !user) {
      console.log('err: ', err);
      throw err || new UnauthorizedException();
    }
    return user;
  }
}
