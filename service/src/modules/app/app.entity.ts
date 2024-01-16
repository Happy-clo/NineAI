import { UserStatusEnum } from '../../common/constants/user.constant';
import { Column, Entity } from 'typeorm';
import { BaseEntity } from 'src/common/entity/baseEntity';

@Entity({ name: 'app' })
export class AppEntity extends BaseEntity {
  @Column({ unique: true, comment: 'App应用名称' })
  name: string;

  @Column({ comment: 'App分类Id' })
  catId: number;

  @Column({ comment: 'App应用描述信息' })
  des: string;

  @Column({ comment: 'App应用预设场景信息', type: 'text' })
  preset: string;

  @Column({ comment: 'App应用封面图片', nullable: true })
  coverImg: string;

  @Column({ comment: 'App应用排序、数字越大越靠前', default: 100 })
  order: number;

  @Column({ comment: 'App应用是否启用中 0：禁用 1：启用', default: 1 })
  status: number;

  @Column({ comment: 'App示例数据', nullable: true, type: 'text' })
  demoData: string;

  @Column({ comment: 'App应用角色 system  user', default: 'system' })
  role: string;

  @Column({ comment: 'App是否共享到应用广场', default: false })
  public: boolean;

  @Column({ comment: '用户Id', nullable: true })
  userId: number;
}
