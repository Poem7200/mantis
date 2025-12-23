import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('jobs')
@Index(['url', 'source'], { unique: true }) // 防止重复爬取同一职位
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 500 })
  title: string;

  @Column({ type: 'varchar', length: 200 })
  company: string;

  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  location: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  salary: string;

  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  @Column({ type: 'timestamp', nullable: true })
  postedAt: Date;

  @Column({ type: 'varchar', length: 100 })
  source: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
